const fetch = require("node-fetch");
const sfauth = require("./salesforce-oauth.js");
const redisClient = require("./configure-redis.js").promisifiedClient;

const SF_APIVERSION = process.env.SF_APIVERSION || "v43.0";
const DEFAULT_STATUSES = ["Active"];
const QUERY_BASE =`/services/data/${SF_APIVERSION}/query?q=select+Id,Name,Text__c,Sorting__c,Question__r.Id,Question__r.Text__c,Question__r.Answer__c,Question__r.Version__r.Name,Question__r.Version__r.Id,Question__r.Version__r.Questionnaire__r.Context__c,Question__r.Version__r.Questionnaire__r.Id,+Question__r.Name,Question__r.Version__r.Greeting_Title__c,Question__r.Version__r.Greeting_Text__c,Question__r.Version__r.Questionnaire_Title__c,Question__r.Version__r.Questionnaire_Text__c,Question__r.Version__r.Confirmation_Title__c,Question__r.Version__r.Confirmation_Text__c,Question__r.Version__r.Enforce_Correct_Answers__c,Question__r.Image__c,Question__r.Sorting__c+from+Basecamp_Answer__c`;
const ORDER_BY=`+ORDER+BY+Question__r.Sorting__c+ASC,+Sorting__c+ASC`;

const getWhereStatus = (statuses) => {
    if (!statuses) return undefined;
    return `Question__r.Version__r.Status__c IN ('${statuses.join("','")}')`;
}
const getWhereId = (ids) => {
    if (!ids) return undefined;
    return `Question__r.Version__r.Id IN ('${ids.join("','")}')`;
}
const loadQuestionnaireData = (options = {}) => {
    const statuses = options.statuses || undefined;
    const versionIds = options.versionIds || undefined;
    
    // get auth data
    return sfauth().then(data => {
        // build context
        const ctx = {
            "sf_credentials": data,
            "questionnaires": {}
        }

        // create url
        let url = `${data.instance_url}${QUERY_BASE}`
        let whereStatus = getWhereStatus(statuses);
        let whereIds = getWhereId(versionIds);
        if (whereStatus || whereIds) url += '+where+';
        if (whereStatus) url += whereStatus;
        if (whereIds && !whereStatus) url += whereIds;
        if (whereIds && whereStatus) url += `+AND+${whereIds}`;

        // query for answer data
        return Promise.all([Promise.resolve(ctx), fetch(url, {
            "headers": {
                "Authorization": `Bearer ${data.access_token}`
            }
        }).then(res => res.json())]);

    }).then(dataArr => {
        // build context
        const ctx = dataArr[0];
        const data = dataArr[1];

        // sanity
        if ((!data.records || !data.records.length) && versionIds && versionIds.length) {
            return Promise.reject(`Unable to load questionnaire for version ID('s) (${versionIds.join()})`)
        } else if (!data.records || !data.records.length) {
            return Promise.resolve(ctx);
        } 

        // process data
        ctx.questionnaires = data.records.reduce((questionnaires, record) => {
            // get refs
            const version = record.Question__r.Version__r;

            // find questionnaire in ctx or create
            const questionnaire = (function(context) {
                if (questionnaires[context]) return questionnaires[context];
                const q = version.Questionnaire__r;
                const obj = {
                    "context": context,
                    "questionnaireid": q.Id,
                    "versionid": version.Id,
                    "enforceCorrect": version.Enforce_Correct_Answers__c, 
                    "greetingTitle": version.Greeting_Title__c,
                    "greetingText": version.Greeting_Text__c,
                    "questionnaireTitle": version.Questionnaire_Title__c,
                    "questionnaireText": version.Questionnaire_Text__c,
                    "confirmationTitle": version.Confirmation_Title__c,
                    "confirmationText": version.Confirmation_Text__c,
                    "questions": [],
                    "questionCount": 0
                }
                questionnaires[context] = obj;
                return obj;
            })(version.Questionnaire__r.Context__c);

            // find question or create
            const question = (function(question, questionnaire) {
                // see if we have question already
                let q = questionnaire.questions.filter(q => q.id === question.Id);
                if (q && q.length) return q[0];
                
                // we don't - create
                const idx = questionnaire.questionCount + 1;
                q = {
                    "index": idx,
                    "id": question.Id,
                    "correctAnswerId": question.Answer__c,
                    "text": question.Text__c,
                    "sorting": question.Sorting__c,
                    "image": undefined,
                    "answers": []
                }
                questionnaire.questionCount = idx;

                // add to array
                questionnaire.questions.push(q);

                // we need to figure out if there is an image attached for the question
                const hostname = ctx.sf_credentials.instance_url;
                const accesstoken = ctx.sf_credentials.access_token;
                const headers = {"headers": {
                    "Authorization": `Bearer ${accesstoken}`
                }};
                const url = `${hostname}/services/data/${SF_APIVERSION}/sobjects/Basecamp_Question__c/${q.id}`;
                q.imagePromise = fetch(url, headers).then(resp => resp.json()).then(data => {
                    // get image refid if any
                    if (data.Image__c) {
                        let regex = data.Image__c.match(/^.*refid=([a-z0-9]{15}).*$/i);
                        if (regex) {
                            let imgRefId = regex[1];
                            if (imgRefId) {
                                return fetch(`${url}/richTextImageFields/Image__c/${imgRefId}`, headers).then(resp => resp.buffer()).then(buf => {
                                    const b64 = buf.toString('base64');
                                    return Promise.resolve({
                                        "base64": b64,
                                        "id": q.id
                                    });
                                })
                            }
                        }
                    }
                    return Promise.resolve();
                })

                // return 
                return q;

            })(record.Question__r, questionnaire);

            // add answer
            question.answers.push({
                "text": record.Text__c, 
                "answerid": record.Id,
                "questionid": question.id,
                "sorting": record.Sorting__c
            })

            // return
            return questionnaires;
        }, {});

        // ensure all data is loaded
        return Promise.all([Promise.resolve(ctx)].concat(Object.values(ctx.questionnaires).reduce((prev, questionnaire) => {
            questionnaire.questions.forEach(q => {
                if (q.imagePromise) prev.push(q.imagePromise);
            })
            return prev;
        }, [])))
        
    }).then(dataArr => {
        const ctx = dataArr[0];

        // add loaded image data to questions
        for (let i=1; i<dataArr.length; i++) {
            // find question and add image data
            Object.values(ctx.questionnaires).forEach(questionnaire => {
                const promise = dataArr[i];
                if (!promise) return;
                const q = questionnaire.questions.filter(q => q.id === dataArr[i].id);
                if (q && q.length) q[0].image = `data:image/png;base64,${dataArr[i].base64}`;
            })
        }
        
        // return data
        return Promise.resolve(ctx.questionnaires);

    })
}

module.exports = loadQuestionnaireData;
