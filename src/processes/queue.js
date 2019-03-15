require("dotenv").config();
const terminateListener = require("../terminate-listener.js");
const queue = require("../configure-queue.js");
const pool = require("../configure-db.js");
const redisClient = require("../configure-redis.js").promisifiedClient;

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
        
        console.log('-------');
        console.log(`${payload.nameData.firstname} ${payload.nameData.lastname} (${payload.nameData.email}, opt-in: ${payload.nameData.optin})`);
        questionnaire.questions.forEach(question => {
            console.log(`${question.index}. ${question.text}, correct: ${question.correct}`);
        })
        console.log('-------');

        // callback and acknowledge the processing of the msg
        callback();
    })
})

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
    queue.close();
    pool.end();
	console.log("Terminated services");
});
