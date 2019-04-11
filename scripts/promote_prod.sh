#!/bin/sh

# get arguments
APP_STAGING=$1
APP_PROD=$2
PIPELINE=$3
TEAM_NAME=$4

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
heroku config:set SF_CLIENT_ID="3MVG9T46ZAw5GTfXfFJkrItF4_aixowhGdQVAO4D71HCMjKwjp4k0gpbPpgnVlQRCuUp3cHnkc6WqFzKorjz4" \
 SF_CLIENT_SECRET="971B6A4BD70A1F34A61E77DCADF3C78E363E1638A9BCA10B55038A1CAF318A5F" \
 SF_PASSWORD='8RectbgVS$*kM74m5vcN' \
 SF_USERNAME="admin@sf-basecamp.com" \
 SF_PERSONACCOUNT_RECORDTYPEID="0121i000000gf14AAA" \
 SF_CALLBACK_URL="https://$APP_PROD.herokuapp.com/oauth/callback" \
 NODE_ENV="demo" \
 SESSION_SECRET="kljashd83eihdn823ueqhjads" \
 --app $APP_PROD

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
