const fetch = require("node-fetch");
const FormData = require("form-data");
const redisClient = require("./configure-redis.js").promisifiedClient;

const VERSION_STATUS = "Active";

module.exports = pool => {
    const formdata = new FormData();
    formdata.append("grant_type", "password");
    formdata.append("client_id", process.env.SF_CLIENT_ID);
    formdata.append("client_secret", process.env.SF_CLIENT_SECRET);
    formdata.append("username", process.env.SF_USERNAME);
    formdata.append("password", process.env.SF_PASSWORD);
    fetch(`${process.env.SF_LOGIN_URL || "https://login.salesforce.com"}/services/oauth2/token`, {
        "method": "post",
        "body": formdata
    }).then(res => res.json()).then(data => {
        // build context
        const ctx = {
            "sf_credentials": data,
            "questionnaires": {}
        }

        // query for questionnaires
        return Promise.all([
            Promise.resolve(ctx),
            pool.query(`select questionnaire.context__c ctx, questionnaire.sfid questionnaireid, version.sfid versionid from salesforce.basecamp_questionnaire__c questionnaire, salesforce.basecamp_version__c version where questionnaire.sfid=version.questionnaire__c and status__c='${VERSION_STATUS}'`)
        ])        
    }).then(data => {
        const ctx = data[0];
        const rs = data[1];
        rs.rows.forEach(row => {
            ctx.questionnaires[row.ctx] = {
                "context": row.ctx,
                "questionnaireid": row.questionnaireid,
                "versionid": row.versionid
            }
        })
        const promises = [
            Promise.resolve(ctx)
        ].concat(rs.rows.map(row => {
            return pool.query(`select text__c text, sfid, sorting__c sorting, image__c image, answer__c anwserid from salesforce.basecamp_question__c where version__c='${row.versionid}' order by sorting__c asc;`)
        }))
        return Promise.all(promises);

    }).then(data => {
        const ctx = data[0];
        let questionIds = [];
        for (let i=1; i<data.length; i++) {
            // add questions to questionnaire
            let j=1;
            const questions = data[i].rows.map(row => {
                const imgRefId = row.image ? row.image.match(/^.*refid=([a-z0-9]{15}).*$/i)[1] : undefined;
                const question = {
                    "index": j++,
                    "id": row.sfid,
                    "correctAnswerId": row.anwserid,
                    "text": row.text,
                    "sorting": row.sorting,
                    "imageRefId": imgRefId
                }
                return question;
            });
            questionIds = questionIds.concat(questions.map(q => q.id));
            ctx.questionnaires[Object.keys(ctx.questionnaires)[i-1]].questions = questions;
        }
        return Promise.all([
            Promise.resolve(ctx),
            pool.query(`select sfid answerid, question__c questionid, text__c text, sorting__c sorting from salesforce.basecamp_answer__c where question__c in ('${questionIds.join(`','`)}') order by questionid, sorting asc;`)
        ]);

    }).then(data => {
        // get questionnaires
        const ctx = data[0];

        // split answers into groups by question id and add to questions
        let holder = {};
        data[1].rows.forEach((row, idx, arr) => {
            let answers = holder[row.questionid];
            if (!answers) {
                answers = [];
                holder[row.questionid] = answers;
            }
            answers.push(row);
        })

        // add answers and create promises for image data
        const promises = [];
        Object.values(ctx.questionnaires).reduce((prev, questionnaire) => {
            return prev.concat(questionnaire.questions);
        }, []).forEach(question => {
            question.answers = holder[question.id];

            if (question.imageRefId) {
                const hostname = ctx.sf_credentials.instance_url;
                const apiversion = process.env.SF_APIVERSION || "v44.0";
                const accesstoken = ctx.sf_credentials.access_token;
                const url = `${hostname}/services/data/${apiversion}/sobjects/Basecamp_Question__c/${question.id}/richTextImageFields/Image__c/${question.imageRefId}`;
                promises.push(fetch(url, {"headers": {
                    "Authorization": `Bearer ${accesstoken}`
                }}).then(res => res.buffer()).then(buf => {
                    const b64 = buf.toString('base64');
                    return Promise.resolve({
                        "base64": b64,
                        "id": question.id
                    });
                }))
            }
        })
        return Promise.all([Promise.resolve(ctx)].concat(promises));
    }).then(data => {
        const ctx = data[0];
        for (let i=1; i<data.length; i++) {
            // find question and add image data
            Object.values(ctx.questionnaires).forEach(questionnaire => {
                const q = questionnaire.questions.filter(q => q.id === data[i].id);
                if (q && q.length) q[0].image = `data:image/png;base64,${data[i].base64}`;
            })
        }

        // grab questionnaires and store each in redis
        return Promise.all(Object.keys(ctx.questionnaires).map(key => redisClient.set(`questionnaire:${key}`, JSON.stringify(ctx.questionnaires[key]))));

    }).catch(err => {
        console.log(err);
        console.log(err.stack);
    })
}
