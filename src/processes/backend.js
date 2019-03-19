require("dotenv").config();
const terminateListener = require("../terminate-listener.js");
const queue = require("../configure-queue.js");
const pool = require("../configure-db.js");
const redisClient = require("../configure-redis.js").promisifiedClient;
const uuid = require('uuid/v4');
const promiseAllSequential = require("promise-all-sequential");
const events = require("../configure-events.js");

// read data from Salesforce
require("../configure-questionnaire-cache.js")(pool);

queue.subscribe((msg, callback) => {
    const payload = JSON.parse(msg.toString());
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
        console.log(`${payload.nameData.firstname} ${payload.nameData.lastname} (${payload.nameData.email}, opt-in: ${payload.nameData.optin})`);
        questionnaire.questions.forEach(question => {
            console.log(`${question.index}. ${question.text}, correct: ${question.correct} (questionid <${question.id}>, answerid <${question.answerid}>)`);
        })
        console.log('-------');

        // generate uuid for questionnaire response external id
        const responseUuid = uuid();

        pool.query("BEGIN").then(rs => {
            // query for account
            return pool.query(`select sfid, external_id__c 
                from salesforce.account 
                where external_id__c='${payload.nameData.email}';`);

        }).then(rs => {
            // we're setting opt-out and have opt-in so reverse 
            const optout = payload.nameData.optin ? 'FALSE' : 'TRUE';
            if (rs.rows.length) {
                // found existing account so update it
                return pool.query(`UPDATE salesforce.Account SET firstname='${payload.nameData.firstname}', lastname='${payload.nameData.lastname}', PersonHasOptedOutOfEmail=${optout} 
                    WHERE PersonEmail='${payload.nameData.email}'`);
            } else {
                // no existing account so insert
                return pool.query(`INSERT INTO salesforce.Account 
                    (External_ID__c, PersonEmail, PersonHasOptedOutOfEmail, firstname, lastname, recordtypeid) 
                    VALUES 
                    ('${payload.nameData.email}', '${payload.nameData.email}', ${optout}, '${payload.nameData.firstname}', '${payload.nameData.lastname}', '${process.env.PERSONACCOUNT_RECORDTYPEID}');`);
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
            events.publish("write-salesforce", `Wrote data for ${payload.nameData.firstname} ${payload.nameData.lastname} to Salesforce for questionnaire <${questionnaire.questionnaireid}>`);
            
            // callback and acknowledge the processing of the msg
            callback();

        }).catch(err => {
            console.log(`Caught error (${err.message}) so rolling tx back`);
            return pool.query("ROLLBACK");
        })
    })
})

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
    queue.close();
    pool.end();
    events.terminate();
	console.log("Terminated services");
});
