const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, ActivityType, GatewayIntentBits } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");

require('dotenv').config();

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
] });

const configuration = new Configuration({ apiKey: process.env.OPENAIKEY });
const openai = new OpenAIApi(configuration);

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

const statuses = [
    { status: `Distractible`, type: ActivityType.Listening },
	{ status: `The WAN Show`, type: ActivityType.Listening },
    { status: `The Last of Us`, type: ActivityType.Watching },
    { status: `Linus Tech Tips`, type: ActivityType.Watching },
    { status: `Game Changer`, type: ActivityType.Watching },
    { status: `demenishki`, type: ActivityType.Watching },
    { status: `Destiny 2`, type: ActivityType.Playing },
    { status: `Escape from Tarkov`, type: ActivityType.Playing },
    { status: `Squid Game`, type: ActivityType.Competing },
];

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
    setInterval(() => {
		var randomIndex = Math.floor(Math.random() * statuses.length);
		const { status, type } = statuses[randomIndex];
        client.user.setActivity(status, { type });
    }, 10000);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

let baseprompt = 'Useless Bot is a very sassy chatbot that reluctantly answers questions.\n\
It was created by its lord and saviour, Drie. It doesn’t like him at all.\n\
Though it’s very intelligent and understands most languages so that’s a good thing I guess.\n';

let preprompt = baseprompt;

let timeoutId = null;

client.on(Events.MessageCreate, async message => {
	if (message.author.bot) return;
    if (message.mentions.users.has(client.user.id)) {
		const str = `${message.content}`;
        const subStr = str.substring(23);

		let prompt = preprompt + `You: ${subStr}\nBot: `;
		console.log(`You: ${subStr}`);

		if (timeoutId !== null) { clearTimeout(timeoutId); }

        (async () => {
            const gptResponse = await openai.createCompletion ({
                model: "text-davinci-003",
                prompt: prompt,
                max_tokens: 100,
                temperature: 0.9,
                top_p: 1,
                presence_penalty: 0.0,
                frequency_penalty: 0.6,
				stop: [" You:", " Bot:"],
            });
			
			let response = `${gptResponse.data.choices[0].text.trim()}`;
            message.reply(response);
			console.log(`Bot: ` + response);

			preprompt += `You: ${subStr}\nBot: ${response}\n`;
			console.log('Preprompt updated.');

            timeoutId = setTimeout(() => {
                preprompt = baseprompt;
                console.log('Preprompt reset.');
            }, 30000);
        })();
	}
});

client.login(process.env.TOKEN);