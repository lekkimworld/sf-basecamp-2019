# Tarilblazer Treasure Hunt App #
Trailblazer Treasure Hunt app showing how to build scalable apps that integrate with Salesforce Lightning Platform.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Add-ons ##
The add-ons used are listed in the `app.json` but is here as well. It's fine to use the free tier for all add-ons.
* CloudAMQP (tier: "lemur")
* Heroku Connect (tier: demo)
* Papertrail (tier: "choklad")
* Heroku Postgresql (tier: "hobby-dev")
* Heroku redis (tier: "hobby-dev")

## Deploying ##
Deploying the app to Heroku is as simple as `git push heroku master` or deploying directly from Github using the Heroku 
dashboard. Please note that the app is built for demo so it doesn't absolutely require you to set any of the 
environment variables or add any of the add-ons the app require. This can be done during the demo. Below is 
the demo script I have used.

There is a version of the demo where I go from creating and showing the app in Staging and progress to Production using a pipeline. To avoid having to redo the configuration and show the power of automation and the Heroku CLI I use the `promote_prod.sh` script in the `scripts` directory. The script does the following:

1. Creates the Pipeline
2. Creates the Production app (in the a team if required)
3. Adds the Staging and Production apps to the Pipeline
4. Configures the Production app with environment variables and add-ons
5. Waits for you to authorize Heroku Connect with Salesforce (as the Heroku CLI Heroku Connect plugin sometimes act up here)
6. Imports the Heroku Connect mappings
7. Promotes from Staging to Production
8. Scales the web tier of the Production app

The script takes the following parameters:

1. The app name in Staging
2. The app name for Production
3. The name of the pipeline to create and add the apps to
4. The team name if any

**Example**
```
$ ./promote_prod.sh my-staging-app my-prod-app my-pipe my-team
```

## Requirements ##
* Heroku CLI
* Heroku Connect plugin (`heroku plugins:install heroku-connect-plugin`)
* jq (https://stedolan.github.io/jq/)

# Demo #
## Prep ##
* Open and log into org
* Open and log into Heroku to Personal apps
* Open Github to repo (https://github.com/lekkimworld/trailblazer-treasure-hunt)

## Salesforce Demo ##
* Open Salesforce and show Questionnaire, Version, Questions and Answers
* We do the configuration in Salesforce because it’s easy and it’s where our users work
* Process Automation
    * We have a Process Builder flow in Salesforce to communicate to the Heroku app when anything changes
    * We have Triggers to verify that status changes are not incorrectly done etc.
* We have a custom Lightning Component to draw the winner

## Heroku Demo ##
* Open Heroku
* Go to the Team used for demo
* Create staging app
* Get source from Github directly
* The app depends on some add-ons - let’s provision those
    * Heroku Redis
    * CloudAMPQ
* Configuration of the app is done through environment variables as it allows us to have different configuration for test, staging, production and so on
    * Show config variables
    * Use script and scale the backend process (`scripts/environment1.sh`)
    * App is now working
* Log and traceability
    * Open log in web ui (I can also tail the log from the CLI)
    * Would like to have better traceability and ability to search the logs and have better retention
    * Add Papertrail
    * Open Papertrail and see events starting to pipe in (if it doesn’t start piping in restart the dynos)
* Data is written back to Salesforce using Heroku Connect
    * For Heroku Connect we need a database to provision it
    * We also need the Heroku Connect add-on
    * Create Connection to Salesforce
    * Create Mappings
    * Show how it’s done using the UI
    * Too error prone for demo - use script (`scripts/environment2.sh`)
* Show scaling the app
