# Discord Bot with OpenAI Integration

This is a basic Discord bot that uses OpenAI's GPT-3 API to generate text-based responses to user messages. It also includes integration with OpenAI's Dall-E image-generation API to generate images based on user prompts.

## Prerequisites

Before running this bot, you will need to set up the following:

- Node.js v16.9.0 or higher. Though this code was developed on v18.14.0.
- A Discord bot token (see https://discordjs.guide/preparations/setting-up-a-bot-application.html)
- An OpenAI API key (see https://beta.openai.com/signup/)

## Installation

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

To start the bot, run:

```
node index.js
```

## Dependencies

This bot relies on the following dependencies:

- dotenv
- discord.js
- openai
- node

## License

This project is licensed under the GNU GPLv3. See the `COPYING` file for details.
