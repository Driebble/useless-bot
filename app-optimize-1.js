import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client, Events, ActivityType, GatewayIntentBits } from 'discord.js';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/files';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const ping = {
  name: 'ping',
  description: 'Pings the bot and shows the latency.',
};

const statuses = [
  { status: `Distractible`, type: ActivityType.Listening },
  { status: `The WAN Show`, type: ActivityType.Listening },
  { status: `No Text to Speech`, type: ActivityType.Watching },
  { status: `VALORANT`, type: ActivityType.Playing },
];

const allowedGuilds = [
  '568355917758857230',
  '1226034307852668938',
];

const allowedChannels = [
  // '1226218710591869028', // Ctrl+Alt+Chill > #bob
  '1152863237017182300', // Data Center > #bot-testing
];

const mediaChannels = [
  // '1231974053041016973'
];

const mimeTypes = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  wav: 'audio/wav',
  mp3: 'audio/mp3',
  aiff: 'audio/aiff',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  // Add more if needed
};

const generationConfig = {
  temperature: 1,
  topK: 64,
  topP: 0.95,
  maxOutputTokens: 8192,
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

const lastResponseTime = {};
let chatWait;
let timeoutId;

client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'ping') {
    await interaction.reply(
      `Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`
    );
  } else {
    await interaction.reply('Command unrecognized.');
  }
});

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  setBotStatus();
  setInterval(setBotStatus, 30000);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const { guild, channel, author, content, attachments } = message;
  const { id: guildId, name: guildName } = guild;
  const { id: channelId, name: channelName } = channel;
  const userName = author.displayName || message.member.nickname || author.username;
  const botNickname = guild.members.me.nickname || client.user.username;

  const botCall = content.toLowerCase().includes(botNickname.toLowerCase()) || message.mentions.users.has(client.user.id);
  const attentionTime = 90000;
  const waitTime = 3000;

  if (allowedChannels.includes(channelId) && attachments.size > 0) {
    await handleAttachments(message, botNickname, userName, content);
  } else if (mediaChannels.includes(channelId) && botCall && attachments.size > 0) {
    await handleAttachments(message, botNickname, userName, content);
  } else if (allowedChannels.includes(channelId) && botCall && !lastResponseTime[channelId]) {
    clearTimeout(timeoutId);
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`);
    await sendResponse(message, botNickname, guildName, channelName, userName, content);
    lastResponseTime[channelId] = Date.now();
    timeoutId = setTimeout(() => stopAttention(channelId, channelName), attentionTime);
  } else if (allowedChannels.includes(channelId) && Date.now() - lastResponseTime[channelId] <= attentionTime) {
    clearTimeout(chatWait);
    chatWait = setTimeout(async () => {
      clearTimeout(timeoutId);
      await sendResponse(message, botNickname, guildName, channelName, userName, content);
      lastResponseTime[channelId] = Date.now();
      timeoutId = setTimeout(() => stopAttention(channelId, channelName), attentionTime);
    }, waitTime);
  }
});

function setBotStatus() {
  const randomIndex = Math.floor(Math.random() * statuses.length);
  const { status, type } = statuses[randomIndex];
  client.user.setActivity(status, { type });
}

async function sendResponse(message, botNickname, guildName, channelName, userName, content) {
  console.log(`\x1b[33m${botNickname} is thinking...\x1b[0m`);

  const chatHistory = await getChatHistory(message.channel);
  const botPersonality = getBotPersonality(botNickname, channelName, guildName);

  const aiResponse = await generateAIResponse(chatHistory, botNickname, content, botPersonality);
  const botResponse = aiResponse.trim();
  await message.channel.send(botResponse);
  console.log(`${botNickname}: ${botResponse}`);
  return botResponse;
}

async function handleAttachments(message, botNickname, userName, userMessage) {
  const attachment = message.attachments.first();
  const cleanUrl = cleanURL(attachment.url);
  const filename = path.basename(cleanUrl);
  const extension = path.extname(filename).toLowerCase();
  const filepath = `./temp/${filename}`;

  await downloadFile(attachment.url, filepath);

  const mimeType = getMimeType(extension);
  if (!mimeType) {
    console.error(`Unsupported file type: ${filename}`);
    return;
  }

  const fileResult = await fileManager.uploadFile(filepath, {
    mimeType,
    name: `files/${path.parse(filename).name}`,
    displayName: path.parse(filename).name,
  });

  const attachmentPrompt = `${userName}: ${userMessage}`;
  const chatHistory = await getChatHistory(message.channel);
  const botPersonality = getBotPersonality(botNickname, message.channel.name, message.guild.name);

  const aiResponse = await processAttachment(botPersonality, chatHistory, attachmentPrompt, fileResult.file);
  const botResponse = aiResponse.trim();

  await message.channel.send(botResponse);
  console.log(`${botNickname}: ${botResponse}`);
  await fileManager.deleteFile(fileResult.file.name);
  return botResponse;
}

function getMimeType(extension) {
  return mimeTypes[extension.slice(1)] || null;
}

async function getChatHistory(channel) {
  const messagesThreshold = Date.now() - 3600000; // 1 hour in milliseconds
  const messages = await channel.messages.fetch({ limit: 24 });
  const recentMessages = messages.filter((msg) => msg.createdTimestamp > messagesThreshold);
  const messageArray = Array.from(recentMessages.values()).reverse();

  return messageArray.map((msg) => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.displayName || msg.author.username : msg.author.username;
    return `${chatAuthor}: ${msg.content.replace(/<@\d+>/g, '').trim()}`;
  }).join('\n');
}

function getBotPersonality(botNickname, channelName, guildName) {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleString('en-US', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  return (`
    ### You are ${botNickname}:
    A very smart Discord bot that talks with people using sarcastic comments, funny remarks, pop culture references, and other things. 
    Refer to yourself in the first person (I, me, mine).
    Be very concise.
    Don't ask if I need help or want to talk about something specific.
    Don't mention the time, date, or how long it's been since I last spoke.
    Never break character.
    ### Rules: 
    * Be concise. 
    * Use a maximum of 2 sentences. 
    * Do not ask questions.
    * Be sarcastic, humorous, and concise.
    * Never admit to being an AI.
    ### Context:
    * Channel: ${channelName}
    * Server: ${guildName}
    * Current Date/Time: ${dateString}
  `);
}

async function generateAIResponse(chatHistory, botNickname, userMessage, botPersonality) {
  const response = await genAI.generateMessage({
    model: 'models/chat-bison-001',
    prompt: `\n### Chat History:\n${chatHistory}\n### User Message:\n${userMessage}\n### Bot Personality:\n${botPersonality}\n### ${botNickname}:`,
    ...generationConfig,
    safetySettings,
  });

  return response.candidates[0].output;
}

async function processAttachment(botPersonality, chatHistory, attachmentPrompt, file) {
  const prompt = `
    ${botPersonality}
    ### Here's the current conversation:
    ${chatHistory}
    ${attachmentPrompt}
    ${file.name}: ${file.url}
    ### ${botNickname}:
  `;
  const response = await genAI.generateMessage({
    model: 'models/chat-bison-001',
    prompt,
    ...generationConfig,
    safetySettings,
  });

  return response.candidates[0].output;
}

async function downloadFile(url, filepath) {
  const fileStream = fs.createWriteStream(filepath);

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => reject(err));
    });
  });
}

function cleanURL(url) {
  return url.split('?')[0];
}

function stopAttention(channelId, channelName) {
  console.log(`\x1b[33m${botNickname} is no longer paying attention to #${channelName}.\x1b[0m`);
  lastResponseTime[channelId] = null;
}

client.login(process.env.DISCORD_TOKEN);
