require("dotenv").config();
const terminateListener = require("../terminate-listener.js");
const queue = require("../configure-queue.js");
const pool = require("../configure-db.js");
const redisClient = require("../configure-redis.js").promisifiedClient;
const uuid = require('uuid/v4');

queue.subscribe((msg, callback) => {
    const payload = JSON.parse(msg.toString());
    console.log(JSON.stringify(payload));
    const answers = payload.answers.reduce((prev, answer) => {
        prev[answer.answerid] = answer;
        return prev;
    }, {});

    // get the questionnaire from redis
    redisClient.get(`questionnaire:${payload.ctx}`).then(data => {
        const questionnaire = JSON.parse(data);
        console.log(JSON.stringify(questionnaire));

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
            console.log(`${question.index}. ${question.text}, correct: ${question.correct}`);
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
            if (rs.rows.length) {
                // found existing account so update it
                return pool.query(`UPDATE salesforce.Account SET firstname='${payload.nameData.firstname}', lastname='${payload.nameData.lastname}', PersonHasOptedOutOfEmail='${payload.nameData.optin ? 'TRUE' : 'FALSE'}' 
                    WHERE PersonEmail='${payload.nameData.email}'`);
            } else {
                // no existing account so insert
                return pool.query(`INSERT INTO salesforce.Account 
                    (External_ID__c, PersonEmail, PersonHasOptedOutOfEmail, firstname, lastname, recordtypeid) 
                    VALUES 
                    ('${payload.nameData.email}', '${payload.nameData.email}', '${payload.nameData.optin ? 'TRUE' : 'FALSE'}', '${payload.nameData.firstname}', '${payload.nameData.lastname}', '${process.env.PERSONACCOUNT_RECORDTYPEID}');`);
            }

        }).then(rs => {
            // create response record
            return pool.query(`INSERT INTO salesforce.basecamp_questionnaire_response__c 
                (questionnaire__c, version__c, account__r__external_id__c, external_id__c) 
                VALUES 
                ('${questionnaire.questionnaireid}', '${questionnaire.versionid}', '${payload.nameData.email}', '${responseUuid}');`);

        }).then(rs => {
            // create a response answer per answer
            return Promise.all(questionnaire.questions.map(q => {
                return pool.query(`INSERT INTO salesforce.basecamp_questionnaire_answer__c 
                    (questionnaire_response__r__external_id__c, answer__c, question__c, external_id__c, correct__c) 
                    VALUES 
                    ('${responseUuid}', '${q.answerid}', '${q.questionid}', '${uuid()}', ${q.correct ? 'TRUE' : 'FALSE'});`);
            }));

        }).then(rs => {
            // commit
            return pool.query("COMMIT");

        }).then(rs => {
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
	console.log("Terminated services");
});
