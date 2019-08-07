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

# get arguments
APP_STAGING=$1
APP_PROD=$2
PIPELINE=$3
TEAM_NAME=$4

# echo syntax
if [ $APP_STAGING == "--help" ]; then
	echo "Syntax is: promote_prod.sh <APP_STAGING> <APP_PROD> <PIPELINE> <TEAM_NAME optional>"
	exit 1
fi

# echo arguments
echo "Staging    : $APP_STAGING"
echo "Production : $APP_PROD"
echo "Pipeline   : $PIPELINE"
if [ -z $TEAM_NAME ]; then
	echo "Team       : <not using>"
else
	TEAM_ARG="--team=${TEAM_NAME}"
	echo "Team       : $TEAM_NAME"
fi

# make sure staging appname does exist
OUTPUT=`heroku apps:info --json --app $APP_STAGING | jq -r ".app.id"`
if [ -z "$OUTPUT" ]; then
	echo "Staging app ($APP_STAGING) does not exist yet - typo?"
	exit 1
fi

# make sure pipeline name does NOT exist
OUTPUT=`heroku pipelines:info --json $PIPELINE | jq -r ".id"`
if [ ! -z "$OUTPUT" ]; then
	echo "Pipeline ($PIPELINE) does exist - please use another!"
	exit 1
fi

# make sure production appname does NOT exist
OUTPUT=`heroku apps:info --json --app $APP_PROD | jq -r ".app.id"`
if [ ! -z "$OUTPUT" ]; then
	echo "Production app ($APP_PROD) does exist - please use another!"
	exit 1
fi

# create the pipeline
heroku pipelines:create --app $APP_STAGING --stage=staging $TEAM_ARG $PIPELINE

# create the production app
heroku apps:create --region eu $TEAM_ARG $APP_PROD

# add production app to pipeline
heroku pipelines:add --app $APP_PROD --stage=production $PIPELINE

# set config in environment
heroku config:set SF_CLIENT_ID="${SF_CLIENT_ID}" \
 SF_CLIENT_SECRET="${SF_CLIENT_SECRET}" \
 SF_PASSWORD="${SF_PASSWORD}" \
 SF_USERNAME="${SF_USERNAME}" \
 SF_PERSONACCOUNT_RECORDTYPEID="${SF_PERSONACCOUNT_RECORDTYPEID}" \
 SF_CALLBACK_URL="https://$APP_PROD.herokuapp.com/oauth/callback" \
 SESSION_SECRET="${SESSION_SECRET}" \
 NODE_ENV="demo" \
 --app $APP_PROD > /dev/null

# provision add-ons
heroku addons:create cloudamqp:lemur --app $APP_PROD
heroku addons:create heroku-redis:hobby-dev --app $APP_PROD
heroku addons:create papertrail:choklad --app $APP_PROD
heroku addons:create heroku-postgresql:hobby-dev --app $APP_PROD
heroku addons:create herokuconnect:demo --app $APP_PROD

# wait for add-ons to provision
heroku addons:wait --app $APP_PROD

# get web_url for Heroku Connect and open to authorize Heroku Copnnect to Salesforcve
open `heroku apps:info --json --app $APP_PROD | jq -r ".addons[] | select(.addon_service.name == \"herokuconnect\") | .web_url"`
read -p "Please authorize Heroku Connect to the Salesforce org - press [Enter] when done..."

# import mappings
heroku connect:import --app $APP_PROD ./heroku-connect-mappings.json

# promote source
heroku pipelines:promote --app $APP_STAGING

# scale processes
heroku ps:scale web=4:Standard-1x backend=1:Standard-1x --app $APP_PROD
