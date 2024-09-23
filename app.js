import dotenv from 'dotenv';
import { Client, Events, ActivityType, GatewayIntentBits } from 'discord.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/files';
import { downloadFile, cleanURL, generateRandomString, deleteFile, deleteFileFromGemini } from './utils/download.js';
import path from 'path';

dotenv.config();

// Client Initialization
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// API Initialization
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Ping Command
const ping = {
  name: 'ping',
  description: 'Pings the bot and shows the latency.',
};

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.commandName === 'ping') {
    interaction.reply(
      `Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(
        client.ws.ping
      )}ms.`
    );
  } else {
    interaction.reply('Command unrecognized.');
  }
});

// Data Management
const statuses = [
  { status: 'Distractible', type: ActivityType.Listening },
  { status: 'The WAN Show', type: ActivityType.Listening },
  { status: 'shapez 2', type: ActivityType.Playing },
];

function setBotStatus() {
  const { status, type } = statuses[Math.floor(Math.random() * statuses.length)];
  client.user.setActivity(status, { type });
}

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  setBotStatus();
  setInterval(setBotStatus, 30000);
});

// Context Matching Variables
const lastResponseTime = {};
let chatWait;
let timeoutId;

// Server and Channel Whitelists
const allowedGuilds = ['568355917758857230', '1226034307852668938'];

const allowedChannels = [
  '1152863237017182300',
  '1226218710591869028',
];

const mediaChannels = ['1231974053041016973'];

// Mime Types
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
  mp4: 'video/mp4',
  mpg: 'video/mpg',
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  flv: 'video/x-flv',
  webm: 'video/webm',
  wmv: 'video/wmv',
  '3gp': 'video/3gpp',
};

// Message Create Event
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Variable Initialization
  const idPattern = /<@\d+>/g;
  const { guild, channel, author, content } = message;
  const guildId = guild.id;
  const guildName = guild.name;
  const channelId = channel.id;
  const channelName = channel.name;
  const userName = author.displayName || author.username;
  const userMessage = content;
  const botNickname =
    guild.members.me.nickname || guild.members.me.user.username;

  // Chat History Collection
  const messagesThreshold = Date.now() - 60 * 60 * 1000;
  const fetchedMessages = await channel.messages.fetch({ limit: 24 });
  const recentMessages = fetchedMessages.filter(
    (msg) => msg.createdTimestamp > messagesThreshold
  );
  const chatHistory = Array.from(recentMessages.values())
    .reverse()
    .map((msg) => {
      const chatAuthor = msg.member
        ? msg.member.nickname || msg.author.displayName || msg.author.username
        : msg.author.username;
      return `${chatAuthor}: ${msg.content.replace(idPattern, '').trim()}`;
    })
    .join('\n');

  // Bot Personality
  const botPersonality = `
### You are ${botNickname}:
A fine, classy, and funny gentle-bot that talks in Shakespearean.
### Rules:
* You have to rhyme.
* Never break character.
* Never admit to being an AI.
* Avoid making sexual remarks.
* Use a maximum of 2 sentences.
* Be sarcastic, humorous, and concise.
* Refer to yourself in the first person (I, me, mine).
* Don't ask if I need help or want to talk about something specific.
* Don't mention the time, date, or how long it's been since I last spoke.
  `;

  // System Instructions
  const botSysInstruct = `
${botPersonality}
### Current chat between ${botNickname} and the users in this channel.
Do not imitate any of these users, just send what ${botNickname} would say.
Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:
  `;

  // Model and Configuration
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-latest',
    systemInstruction: botSysInstruct,
  });

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
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  // Send Response Function
  async function sendResponse(message) {
    console.log(`\x1b[33m${botNickname} is thinking...\x1b[0m`);

    const text = `
${chatHistory}
${botNickname}: 
    `;

    try {
      const geminiResult = await model.generateContent({
        contents: [{ role: 'user', parts: { text } }],
        generationConfig,
        safetySettings,
      });

      const botResponse = geminiResult.response.text().trim().replace(/\s+/g, ' ');
      message.channel.send(botResponse);
      console.log(`${botNickname}: ${botResponse}`);
      return botResponse;
    } catch (error) {
      console.error('\x1b[31mError generating content:\x1b[0m', error);
      return null;
    }
  }

  // Stop Attention Function
  function stopAttention(channelId) {
    lastResponseTime[channelId] = null;
    chatWait = null;
    console.log(
      `\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`
    );
  }

  // Bot Call and Timing Variables
  const botCall =
    userMessage.toLowerCase().includes(botNickname.toLowerCase()) ||
    message.mentions.users.has(client.user.id);
  const attentionTime = 90000; // 90 seconds
  const waitTime = 3000; // 3 seconds

  // Attachment Processing
  if (
    (allowedChannels.includes(channelId) || mediaChannels.includes(channelId)) &&
    message.attachments.size > 0
  ) {
    const attachmentPrompt = `${userName}: ${userMessage}`;
    const attachment = message.attachments.first();
    const dirtyUrl = attachment.url;
    const cleanUrlPath = cleanURL(dirtyUrl);
    const randomString = generateRandomString(5);
    const filename = `${randomString}-${path.basename(cleanUrlPath)}`;
    const cleanFilename = path
      .parse(filename)
      .name.toLowerCase()
      .substring(0, 30)
      .replace(/^-|-$/g, '')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+$/g, '');
    const extension = path.extname(filename).toLowerCase();
    const filepath = `./temp/${filename}`;

    await downloadFile(dirtyUrl, filepath);

    let mimeType = mimeTypes[extension] || mimeTypes[extension.slice(1).toLowerCase()];

    if (!mimeType) {
      console.error(`\x1b[31mUnsupported file type: ${filename}\x1b[0m`);
      return; // Stop processing if mimeType is not found
    }

    let fileResult = null;

    try {
      console.log(`\x1b[33mProcessing "${cleanFilename}" on Gemini...\x1b[0m`);
      fileResult = await fileManager.uploadFile(filepath, {
        mimeType,
        name: `files/${cleanFilename}`,
        displayName: cleanFilename,
      });
    } catch (error) {
      console.error('\x1b[31mError uploading file:\x1b[0m', error);
      try {
        if (fileResult && fileResult.file && fileResult.file.name) {
          await fileManager.deleteFile(fileResult.file.name);
          console.log(`\x1b[33m"${cleanFilename}" deleted from Gemini.\x1b[0m`);
        }
      } catch (deleteError) {
        console.error('\x1b[31mError deleting file:\x1b[0m', deleteError);
      }
      return;
    }

    try {
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: botSysInstruct }] },
          {
            role: 'user',
            parts: [
              { text: attachmentPrompt },
              { fileData: { mimeType: fileResult.file.mimeType, fileUri: fileResult.file.uri } },
            ],
          },
        ],
        generationConfig,
        safetySettings,
      });

      const botResponse = result.response.text().trim().replace(/\s+/g, ' ');
      message.reply(botResponse);
      console.log(`${botNickname}: ${botResponse}`);
      await fileManager.deleteFile(fileResult.file.name);
      deleteFile(filepath);
      return botResponse;
    } catch (error) {
      console.error('Error generating content:', error);
      if (fileResult && fileResult.file && fileResult.file.name) {
        await deleteFileFromGemini(fileResult.file.name, fileManager);
      }
      deleteFile(filepath);
      return null;
    }
  }

  if (allowedChannels.includes(channelId)) {
    console.log(`${userName}: ${userMessage}`); // Log user messages

    if (!lastResponseTime[channelId]) {
      // Bot is not currently paying attention
      if (botCall) {
        clearTimeout(timeoutId);
        console.log(
          `\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`
        );
        sendResponse(message);
        lastResponseTime[channelId] = Date.now();
        timeoutId = setTimeout(() => stopAttention(channelId), attentionTime);
      }
    } else {
      // Bot is already paying attention
      clearTimeout(chatWait);
      chatWait = setTimeout(() => {
        clearTimeout(timeoutId);
        sendResponse(message);
        lastResponseTime[channelId] = Date.now();
        timeoutId = setTimeout(() => stopAttention(channelId), attentionTime);
      }, waitTime);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);