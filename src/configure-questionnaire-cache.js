const redisClient = require("./configure-redis.js").promisifiedClient;
const loadQuestionnaireData = require("./load-questionnaire-data.js");

module.exports = () => {
    loadQuestionnaireData({"statuses": ["Active"]}).then(ctx => {
        // grab questionnaires and store each in redis
        return Promise.all(Object.keys(ctx).map(key => {
            const redisKey = `questionnaire:${key}`;
            console.log(`Storing questionnaire using key <${redisKey}> in redis`);
            redisClient.set(redisKey, JSON.stringify(ctx[key]));
        }));

    }).catch(err => {
        console.log(err);
        console.log(err.stack);
    })
}
