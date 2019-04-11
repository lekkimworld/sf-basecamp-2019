#!/bin/sh

APP_STAGING=$1

# make sure staging appname does exist
if [ -z "$APP_STAGING" ]; then
    echo "Please supply appname"
    exit 1
fi
echo "Staging    : $APP_STAGING"
OUTPUT=`heroku apps:info --json --app $APP_STAGING | jq -r ".app.id"`
if [ -z "$OUTPUT" ]; then
	echo "Staging app ($APP_STAGING) does not exist yet - typo?"
	exit 1
fi

# import mappings
heroku connect:import ./heroku-connect-mappings.json --app $APP_STAGING
