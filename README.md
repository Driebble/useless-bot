# Discord Bot with OpenAI's ChatGPT capabilities

This is a basic Discord bot that utilizes OpenAI's latest ChatGPT API to generate text-based responses to user messages. It also includes integration with OpenAI's Dall-E 2 image-generation API to generate images based on user prompts.

<img src="assets/sample/160507.png" alt="alt text" width="200"> <img src="assets/sample/160851.png" alt="alt text" width="200"> <img src="assets/sample/161136.png" alt="alt text" width="200"> <img src="assets/sample/161450.png" alt="alt text" width="200"> <img src="assets/sample/162259.png" alt="alt text" width="200">

## Warning!

OpenAI API is not free. Though you can start with free credits on your first sign up. This code has been updated to utilize the `gpt-3.5-turbo` model. It's 10x more cheaper than the previous `text-davinci-003` model. Please check https://openai.com/pricing for mor details.

## Features

- Responds to messages with an OpenAI text-completion model API call.
- Responds with a sarcastic tone by default. You can change this behaviour in the `botPersonality` variable.
- Generates an image based on the user's message using OpenAI Dall-E 2 model API call.
- Pays attention to the channel for a specific amount of time when the bot is called.
- Waits for a certain amount of time before responding to the message to prevent flooding the API with calls.

## Prerequisites

Before running this bot, you will need to set up the following:

- Node.js v16.9.0 or higher. Though this code was developed on v18.14.0.
- A Discord bot token (see https://discordjs.guide/preparations/setting-up-a-bot-application.html)
- An OpenAI API key (see https://beta.openai.com/signup/)

## Installation

### Dependencies

This bot relies on the following dependencies:

- dotenv
- discord.js
- openai

To install the necessary dependencies, run:

```
 npm install
```

Then, create a `.env` file in the project root directory with the following contents:

```
DISCORD_TOKEN=<your Discord bot token>
OPENAI_KEY=<your OpenAI API key>
```

## Usage

I recommend checking the code and modify to your preferences before running the bot.

To start the bot, run:

```
node index.js
```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
