require("dotenv").config();
const terminateListener = require("../terminate-listener.js");
const redisClient = require("../configure-redis.js").promisifiedClient;
const uuid = require('uuid/v4');
const promiseAllSequential = require("promise-all-sequential");
const events = require("../configure-events.js");
const sfauth = require("../salesforce-oauth.js");
const cache = require("../configure-questionnaire-cache.js");
const jsforce = require('jsforce');
const pool = require("../configure-db.js");

// read data from Salesforce
cache.initialize();

// write to database
const writePayloadToDatabase = (payload) => {
    // if no database connection simply log and resolve
    if (!process.env.DATABASE_URL) {
        console.log("No DATABASE_URL found in environment so cannot write to database");
        return Promise.resolve();
    }

    // generate uuid for questionnaire response external id
    console.log("Found DATABASE_URL in environment - will write to database");
    const responseUuid = uuid();

    return pool.query("BEGIN").then(rs => {
        // query for account
        return pool.query(`select sfid, external_id__c 
            from salesforce.account 
            where external_id__c='${payload.nameData.email}';`);

    }).then(rs => {
        // we're setting opt-out and have opt-in so reverse 
        const optout = payload.nameData.optin ? 'FALSE' : 'TRUE';
        if (rs.rows.length) {
            // found existing account so update it
            return pool.query(`UPDATE salesforce.Account SET firstname='${payload.nameData.firstname}', lastname='${payload.nameData.lastname}', Company_Name__pc='${payload.nameData.company}', PersonHasOptedOutOfEmail=${optout} 
                WHERE PersonEmail='${payload.nameData.email}'`);
        } else {
            // no existing account so insert
            return pool.query(`INSERT INTO salesforce.Account 
                (External_ID__c, PersonEmail, PersonHasOptedOutOfEmail, firstname, lastname, Company_Name__pc, recordtypeid) 
                VALUES 
                ('${payload.nameData.email}', '${payload.nameData.email}', ${optout}, '${payload.nameData.firstname}', '${payload.nameData.lastname}', '${payload.nameData.company}', '${process.env.SF_PERSONACCOUNT_RECORDTYPEID}');`);
        }

    }).then(rs => {
        // create response record
        return pool.query(`INSERT INTO salesforce.basecamp_questionnaire_response__c 
            (questionnaire__c, version__c, account__r__external_id__c, external_id__c) 
            VALUES 
            ('${questionnaire.questionnaireid}', '${questionnaire.versionid}', '${payload.nameData.email}', '${responseUuid}');`);

    }).then(rs => {
        // create a response answer per answer but do it using sequential promises as 
        // heroku connect otherwise cannot see forign key
        const promises = questionnaire.questions.map(q => {
            return () => pool.query(`INSERT INTO salesforce.basecamp_questionnaire_answer__c 
                (questionnaire_response__r__external_id__c, answer__c, question__c, external_id__c, correct__c) 
                VALUES 
                ('${responseUuid}', '${q.answerid}', '${q.id}', '${uuid()}', ${q.correct ? 'TRUE' : 'FALSE'});`);
        });
        return promiseAllSequential(promises);
        
    }).then(rs => {
        // commit
        return pool.query("COMMIT");

    }).then(rs => {
        // write to event stream
        events.topics.events.publish("salesforce.write", `Wrote data for ${payload.nameData.firstname} ${payload.nameData.lastname} (${payload.nameData.company}) to Salesforce for questionnaire <${questionnaire.questionnaireid}>`);
        
        // return
        return Promise.resolve();

    }).catch(err => {
        console.log(`Caught error (${err.message}) so rolling tx back`);
        return pool.query("ROLLBACK").then(() => Promise.reject(err));
    })
}

/**
 * Reload all questionnaires if asked to.
 */
events.queues.admin.subscribe((payload, callback) => {
    if (payload.type === "cache.questionnaire" && payload.action === "invalidate") {
        require("../configure-questionnaire-cache.js")();
    }

    // acknowledge message
    callback();
})

/**
 * Write to Salesforce.
 */
events.queues.writesf.subscribe((payload, callback) => {
    if (!payload.answers) {
        // no answers in payload - that's an error
        console.log(`ERROR - Received payload to write to Salesforce but there are no answers - ignore`);
        return callback();
    }
    const answers = payload.answers.reduce((prev, answer) => {
        prev[answer.answerid] = answer;
        return prev;
    }, {});

    // get the questionnaire from redis
    redisClient.get(`questionnaire:${payload.ctx}`).then(data => {
        const questionnaire = JSON.parse(data);
        
        // figure out what questions are correct        
        questionnaire.questions.forEach(question => {
            const correctAnswerId = question.correctAnswerId;
            let correct = false;
            question.answers.forEach(answer => {
                const actualAnswer = answers[answer.answerid];
                if (actualAnswer && correctAnswerId === actualAnswer.answerid) correct = true;
            })
            
            const providedAnswer = payload.answers.reduce((prev, answer) => {
                if (prev) return prev;
                if (answer.questionid === question.id) return answer
            }, undefined)

            // update question
            question.correct = correct;
            question.answerid = providedAnswer ? providedAnswer.answerid : undefined;
        })
        
        // log it
        console.log('-------');
        console.log(`${payload.nameData.firstname} ${payload.nameData.lastname} (${payload.nameData.company} / ${payload.nameData.email}, opt-in: ${payload.nameData.optin})`);
        questionnaire.questions.forEach(question => {
            console.log(`${question.index}. ${question.text}, correct: ${question.correct} (questionid <${question.id}>, answerid <${question.answerid}>)`);
        })
        console.log('-------');

        // write to database if we need to
        writePayloadToDatabase(payload).then(() => {
            // callback and acknowledge the processing of the msg
            callback();

        }).catch(err => {
            // we should not acknowledge the message
        })
        
    })
})

/**
 * Listen for Platform Events from Salesforce to reload questionnaire 
 * on version activation.
 */
sfauth().then(data => {
    // create connection
    const conn = new jsforce.Connection({
        "instanceUrl": data.instance_url,
        "accessToken": data.access_token
    });
    conn.streaming.topic("/event/Basecamp_Version_Activation__e").subscribe(msg => {
        const versionId = msg.payload.Version_ID__c;
        const context = msg.payload.Context__c;
        const status = msg.payload.Status__c;
        console.log(`Received Platform Event for Version Activation with context <${context}>, version ID <${versionId}>, status <${status}>`);
        try {
            if (status === "active") {
                cache.load(context, versionId);
            } else if (status === "retired") {
                cache.remove(context);
            } else {
                console.log(`WARNING - unknown status <${status}> received in Platform event`);
            }
        } catch (err) {
            console.log(err);
        }
    });
}).catch(err => {
    console.log(err);
})

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
    events.close();
	console.log("Terminated services");
});
