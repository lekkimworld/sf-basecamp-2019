#!/bin/sh

APP_STAGING=$1

# make sure staging appname does exist
if [ -z "$APP_STAGING" ]; then
    echo "Please supply appname"
    exit 1
fi
echo "Staging    : $APP_STAGING"

# make sure staging appname does exist
OUTPUT=`heroku apps:info --json --app $APP_STAGING | jq -r ".app.id"`
if [ -z "$OUTPUT" ]; then
	echo "Staging app ($APP_STAGING) does not exist yet - typo?"
	exit 1
fi

# set config
heroku config:set SF_CLIENT_ID="3MVG9T46ZAw5GTfXfFJkr...lQRCuUp3cHnkc6WqFzKorjz4" \
 SF_CLIENT_SECRET="971B6A4BD70A1...CA10B55038A1CAF318A5F" \
 SF_PASSWORD='8R...cN' \
 SF_USERNAME="admin@this.is.my.username.com" \
 SF_PERSONACCOUNT_RECORDTYPEID="0121i000000gf14AAA" \
 SF_CALLBACK_URL="https://$APP_STAGING.herokuapp.com/oauth/callback" \
 SESSION_SECRET="298...hndd" \
 NODE_ENV=demo \
 --app $APP_STAGING

# scale backend process
 heroku ps:scale backend=1:Hobby --app $APP_STAGING
