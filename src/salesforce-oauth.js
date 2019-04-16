const fetch = require("node-fetch");
const FormData = require("form-data");

module.exports = () => {
    // create form data
    const formdata = new FormData();
    formdata.append("grant_type", "password");
    formdata.append("client_id", process.env.SF_CLIENT_ID);
    formdata.append("client_secret", process.env.SF_CLIENT_SECRET);
    formdata.append("username", process.env.SF_USERNAME);
    formdata.append("password", process.env.SF_PASSWORD);
    
    // login
    return fetch(`https://${process.env.SF_LOGIN_URL || "login.salesforce.com"}/services/oauth2/token`, {
        "method": "post",
        "body": formdata
    }).then(res => res.json()).then(data => {
        if (data.error) {
            const err = Error(data.error);
            err.data = data;
            return Promise.reject(err);
        }
        
        // return
        return Promise.resolve(data);
    })
}
