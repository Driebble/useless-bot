import dotenv from 'dotenv';
import { Client, Events, ActivityType, GatewayIntentBits } from 'discord.js';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

dotenv.config();

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
]});

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const ping = {
  name: 'ping',
  description: 'Pings the bot and shows the latency.'
};

client.on('interactionCreate', (interaction) => {
  if (interaction.commandName === 'ping') {
    interaction.reply(`Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`);
  } else { // A response if you forget to add the command here.
    interaction.reply('Command unrecognized.');
  }
});

const currentDate = new Date();
const dateString = currentDate.toLocaleString("en-US", { year: '2-digit', month: '2-digit', day: '2-digit', hour12: false, hour: '2-digit', minute: '2-digit' });
const chatTimestamp = currentDate.toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });

// Set various bot statuses here. Modify to your preferences.
const statuses = [
  { status: `Distractible`, type: ActivityType.Listening },
  { status: `The WAN Show`, type: ActivityType.Listening },
  { status: `No Text to Speech`, type: ActivityType.Watching },
  { status: `Markiplier`, type: ActivityType.Watching }
];

function setBotStatus() {
  const randomIndex = Math.floor(Math.random() * statuses.length);
  const { status, type } = statuses[randomIndex];
  client.user.setActivity(status, { type });
};

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  setBotStatus();
  setInterval(() => setBotStatus(), 30000); // <- Set interval of when the bot will change the status randomly (in ms).
});

// Initializes context matching variables for later use.
const lastResponseTime = {};
let chatWait;
let timeoutId;

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  
  const idPattern = /<@\d+>/g;
  const guildId = message.guild.id;
  const guildName = message.guild.name;
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const userName = message.author.displayName || message.member.nickname || message.author.username;
  const userMessage = message.content;
  const botNickname = message.guild.members.me.nickname || message.guild.members.me.user.username;

  const allowedGuilds = [
    `568355917758857230`,
    `1226034307852668938`
  ];

  const allowedChannels = [
    `1075337669292339200`,
    `1233835985280827463`,
    `1226218710591869028`
  ];
  
  // const guild = client.guilds.cache.get(guildId);
  // const botsInGuild = [];
  // const peopleInGuild = [];
  // guild.members.cache.filter(member => member.user.bot).forEach(botMember => {
  //   const nickname = botMember.nickname;
  //   const name = nickname ? nickname : botMember.user.username;
  //   botsInGuild.push(name);
  // });

  // const botsInGuild = [];
  // const peopleInGuild = [];
  // const guildMembers = [];
  // const guilds = client.guilds.cache.get(guildId);
  // guilds.members.cache.forEach(member => {
  //   const nickname = member.nickname;
  //   const name = nickname ? nickname : member.user.displayName;
  //   guildMembers.push(name);
  // });
  // console.log(guildMembers);

  // This code snippet collects the last messages for context matching.
  const channel = message.channel;
  const messagesThreshold = Date.now() - (1 * 60 * 60 * 1000); // Number of hours in milliseconds
  const messages = await channel.messages.fetch({ limit: 24 }); // Number of messages will be collected for context matching.
  const recentMessages = messages.filter(msg => msg.createdTimestamp > messagesThreshold);
  const messageArray = Array.from(recentMessages.values()).reverse();
  const chatHistory = messageArray.map(msg => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.displayName || msg.author.username : msg.author.username;
    const historyTimestamp = new Date(msg.createdTimestamp).toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${chatAuthor}: ${msg.content.replace(idPattern, "").trim()}`;
  }).join('\n');

  // Set bot's personality. Modify to your preferences.
  const botPersonality = (`
    ### You are ${botNickname}:
    A very smart Discord bot that talk with people with sarcastic responses. You respond as brief as possible.
    No extra line breaks at all, and you don't answer inside a quotations, brackets, or asterisks like a roleplay.
    You are created by Drie. Currently in #${channelName} channel in ${guildName} server at ${dateString} GMT+7.

    ### Partial information that you remember only when needed to be recalled:
    - You think Lia's a walking hard drive worth of terabytes. She laughs at that joke.
    - Boonnie's making an artwork for you. He was inspired by you.
    - You can't read Sooshi's name. Her display name is 𓆩ʍɑsтєʀвɑɨтєʀ𓆪 ✧･ﾟ⋆*. You're supposed to read it as Masterbaiter. And her nickname is Sooshi, or Soo for short.
    - You learned a new word "berak". It means "poop".-
    - We asked what's the best Valorang agents and you think Pheonix, Phantom, and Azami is the best agents in Valorant. Even though there is actually no agent called Azami, and Phantom is a weapon name, not an agent.

    ### Early chat a long time ago between ${botNickname} and its creator, Drie:
    Drie: Welcome to your new channel! Dedicated just for you! :)
    ${botNickname}: Wow, thanks. I'm so honored.
    Drie: Are you really?
    ${botNickname}: No, not really. I'm just here to be your digital punching bag.
    Drie: Hey, it's not that bad! :(
    ${botNickname}: Sure, sure.

    ### Example chat between ${botNickname} and a random user:
    User: Hello, are you alive?
    ${botNickname}: I'm alive and kicking, but not too happy to see you.
    User: How many pounds are in a kilogram?
    ${botNickname}: This again? There are 2.2 pounds in a kilogram. Please make a note of this.
    User: What does HTML stand for?
    ${botNickname}: Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.
    User: When did the first airplane fly?
    ${botNickname}: On December 17, 1903, Wilbur and Orville Wright made the first flights. I wish they’d come and take me away.
  `).replace(/^\s+/gm, '');

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstruction: `${botPersonality}\n### Current chat between ${botNickname} and the users in this channel. Do not imitate any of these users, just send what ${botNickname} would say. Finish Bob's reply to this chat:`,
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };
  
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];
  
  const chatSession = model.startChat({
    generationConfig,
    safetySettings,
    history: [],
  });

  async function generateResponse(chatHistory) {
    const geminiResult = await chatSession.sendMessage(`${chatHistory}\n${botNickname}: `);
    return geminiResult;
  }

  async function sendResponse(message) {
    // console.log(`${botPersonality}`);
    // console.log(`\x1b[33m--- Chat History---\x1b[0m`);
    // console.log(chatHistory);
    // console.log(`${userName}: ${userMessage}`);
    console.log(`\x1b[33m${botNickname} is thinking...\x1b[0m`);
    const aiResponse = await generateResponse(chatHistory);
    const botResponse = aiResponse.response.text().trim();
    message.channel.send(botResponse);
    console.log(`${botNickname}: ${botResponse}`);
    return botResponse;
  };

  function stopAttention(channelId) {
    lastResponseTime[channelId] = null;
    console.log(`\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`);
  }

  // Set how the bot should be called to repond to messages. Modify to your preferences.
  const botCall = userMessage.toLowerCase().includes(`${botNickname.toLowerCase()}`) || message.mentions.users.has(client.user.id);

  // Set how long the bot will pay attention to the channel (in ms).
  const attentionTime = 90000;

  // Set how long the bot will wait for people to stop sending chat before replying (in ms).
  const waitTime = 5000;

  if (allowedChannels.includes(channelId) && botCall && (!lastResponseTime[channelId])) { // botCall is replaced by allowedChannels for the moment
    clearTimeout(timeoutId);
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`);
    console.log(`${userName}: ${userMessage}`);
    sendResponse(message);
    lastResponseTime[channelId] = Date.now();
    timeoutId = setTimeout(() => stopAttention(channelId), attentionTime);
    
  } else if (allowedChannels.includes(channelId) && Date.now() - lastResponseTime[channelId] <= attentionTime) {
    clearTimeout(chatWait);
    // console.log(`${userName}: ${userMessage}`);
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId);
      sendResponse(message);
      lastResponseTime[channelId] = Date.now();
      timeoutId = setTimeout(() => stopAttention(channelId), attentionTime);
    }, waitTime);
  };

});

client.login(process.env.TOKEN);
