#!/bin/sh

ENVFILE=`pwd`/.env-scripts
echo "Looking for $ENVFILE"
if [ ! -f $ENVFILE ]; then
    echo "$ENVFILE file does not exist - please create it..."
    exit 1
else
    source $ENVFILE
    echo "Sourced $ENVFILE"
fi

# use hardcoded SESSION_SECRET if not set
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET='93843984hdfnknkf3874isdhdss'
fi

# read app name
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
heroku config:set SF_CLIENT_ID="${SF_CLIENT_ID}" \
 SF_CLIENT_SECRET="${SF_CLIENT_SECRET}" \
 SF_PASSWORD="${SF_PASSWORD}" \
 SF_USERNAME="${SF_USERNAME}" \
 SF_PERSONACCOUNT_RECORDTYPEID="${SF_PERSONACCOUNT_RECORDTYPEID}" \
 SF_CALLBACK_URL="https://$APP_STAGING.herokuapp.com/oauth/callback" \
 SESSION_SECRET="${SESSION_SECRET}" \
 NODE_ENV=demo \
 --app $APP_STAGING > /dev/null

 if [ ! -z "$SF_LOGIN_URL" ]; then
    heroku config:set SF_LOGIN_URL="${SF_LOGIN_URL}" \
 --app $APP_STAGING > /dev/null
fi

# scale backend process
 heroku ps:scale backend=1:Hobby --app $APP_STAGING
