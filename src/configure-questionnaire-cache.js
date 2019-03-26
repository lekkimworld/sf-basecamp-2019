const redisClient = require("./configure-redis.js").promisifiedClient;
const loadQuestionnaireData = require("./load-questionnaire-data.js");

const QUESTIONNAIRE_KEY_PREFIX = "questionnaire:";

module.exports = {
    "initialize": () => {
        loadQuestionnaireData({"statuses": ["Active"]}).then(ctx => {
            // grab questionnaires and store each in redis
            return Promise.all(Object.keys(ctx).map(key => {
                const redisKey = `${QUESTIONNAIRE_KEY_PREFIX}${key}`;
                console.log(`Storing questionnaire using key <${redisKey}> in redis`);
                redisClient.set(redisKey, JSON.stringify(ctx[key]));
            }));

        }).catch(err => {
            console.log(err);
            console.log(err.stack);
        })
    },
    "remove": (contextPath) => {
        const redisKey = `${QUESTIONNAIRE_KEY_PREFIX}${contextPath}`;
        console.log(`Deleting questionnaire from cache (key <${redisKey}>)`);
        redisClient.del(redisClient).then(() => {
            console.log(`Deleted questionnaire with key <${redisKey}> from cache`);
        }).catch(err => {
            console.log(`ERROR - unable to delete questionnaire with key <${redisKey}> from cache`);
        })
    },
    "load": (contextPath, versionId) => {
        loadQuestionnaireData({"versionIds": [versionId]}).then(ctx => {
            // sanity
            if (Object.keys(ctx).length !== 1 || Object.keys(ctx)[0] !== contextPath) {
                console.log(`Refusing to update Redis as returned data is not for the reloaded context (${Object.keys(ctx)[0]} !== ${contextPath})`);
                return;
            }

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
}
