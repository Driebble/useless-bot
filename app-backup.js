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
import { GoogleAIFileManager } from "@google/generative-ai/files";

dotenv.config();

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
]});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

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
  { status: `VALORANT`, type: ActivityType.Playing }
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

// Server whitelist
const allowedGuilds = [
  `568355917758857230`,
  `1226034307852668938`
];

// Channel whitelist
const allowedChannels = [
  `1075337669292339200`,
  `1233835985280827463`,
  `1226218710591869028`, // Ctrl+Alt+Chill > #bob
  `1152863237017182300`, // Data Center > #bot-testing
];

// Media channel whitelist
const mediaChannels = [
  // `1231974053041016973`
];

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

  // This block collects the last messages for context matching.
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
    // systemInstruction: `${botPersonality}\n### Current chat between ${botNickname} and the users in this channel. Do not imitate any of these users, just send what ${botNickname} would say. Finish Bob's reply to this chat:`,
  });
  
  const generationConfig = {
    temperature: 1,
    topK: 64,
    topP: 0.95,
    maxOutputTokens: 8192
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

  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'wav': 'audio/wav',
    'mp3': 'audio/mp3',
    'aiff': 'audio/aiff',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    // 'mp4': 'video/mp4',
    // 'mpg': 'video/mpg',
    // 'mpeg': 'video/mpeg',
    // 'mov': 'video/mov',
    // 'avi': 'video/avi',
    // 'flv': 'video/x-flv',
    // 'webm': 'video/webm',
    // 'wmv': 'video/wmv',
    // '3gp': 'video/3gpp'
  };

  async function sendResponse(message) {
    console.log(`\x1b[33m${botNickname} is thinking...\x1b[0m`);
    async function generateResponse(chatHistory) {
      const text = `${botPersonality}### Current chat between ${botNickname} and the users in this channel. Do not imitate any of these users, just send what ${botNickname} would say. Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:\n${chatHistory}\n${botNickname}: `;
      const geminiResult = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: { text: text }
          }
        ],
        generationConfig,
        safetySettings
      });
      return geminiResult;
    }
    const aiResponse = await generateResponse(chatHistory);
    const botResponse = aiResponse.response.text().trim();
    message.channel.send(botResponse);
    console.log(`${botNickname}: ${botResponse}`);
    return botResponse;
  }

  function stopAttention(channelId) {
    lastResponseTime[channelId] = null;
    console.log(`\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`);
  }

  // Set how the bot should be called to repond to messages. Modify to your preferences.
  const botCall = userMessage.toLowerCase().includes(`${botNickname.toLowerCase()}`) || message.mentions.users.has(client.user.id);

  // Set how long the bot will pay attention to the channel (in ms).
  const attentionTime = 90000;

  // Set how long the bot will wait for people to stop sending chat before replying (in ms).
  const waitTime = 3000;

  if (allowedChannels.includes(channelId) && message.attachments.size > 0) {
    const attachmentPrompt = `${userName}: ${userMessage}`;
    const attachment = message.attachments.first();
    const dirtyUrl = attachment.url;
    const cleanUrl = cleanURL(dirtyUrl);
    const filename = path.basename(cleanUrl);
    const cleanFilename = path.parse(filename).name.toLowerCase()
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .replace(/_/g, '-') // Replace underscores with dashes
      .replace(/[^a-z0-9-]/g, ''); // Remove non-alphanumeric characters;
    const extension = path.extname(filename).toLowerCase();
    const filepath = "./temp/" + filename;
    await downloadFile(dirtyUrl, filepath);

    let mimeType;
    if (mimeTypes.hasOwnProperty(extension)) {
      mimeType = mimeTypes[extension];
    } else {
      const alternateExtension = extension.slice(1).toLowerCase(); // Remove leading dot
      if (mimeTypes.hasOwnProperty(alternateExtension)) {
        mimeType = mimeTypes[alternateExtension];
      } else {
        console.error(`Unsupported file type: ${filename}`);
        // Handle unsupported file
      }
    }

    function cleanURL(url) {
      // Use URL object to parse the URL
      const urlObject = new URL(url);
      // Return only the origin and pathname
      return urlObject.origin + urlObject.pathname;
    }
    
    function downloadFile(dirtyUrl, filepath) {
      return new Promise((resolve, reject) => {
        https.get(dirtyUrl, (res) => {
          const fileStream = fs.createWriteStream(filepath);
          res.pipe(fileStream);
      
          fileStream.on('finish', () => {
              fileStream.close();
              console.log('Attatchment downloaded.');
              resolve(); // Resolve the promise on successful download
          });
    
          fileStream.on('error', (error) => {
            reject(error); // Reject the promise on download error
          });
        })
      });
    }

    const fileResult = await fileManager.uploadFile(filepath, {
      mimeType: mimeType,
      // It will also add the necessary "files/" prefix if not provided
      name: "files/" + cleanFilename,
      displayName: cleanFilename
    });

    async function processAttachment(attachmentPrompt, chatHistory) {
      const text = `${botPersonality}### Current chat between ${botNickname} and the users in this channel. Do not imitate any of these users, just send what ${botNickname} would say. Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:`;
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: text },
            ],
          },
          {
            role: "user",
            parts: [
              { text: chatHistory },
            ],
          },
          {
            role: "user",
            parts: [
              { text: attachmentPrompt },
              {
                fileData: {
                  mimeType: fileResult.file.mimeType,
                  fileUri: fileResult.file.uri
                }
              },
            ],
          },
        ],
        generationConfig,
        safetySettings
      });
      const response = result.response;
      const imageDescription = response.text().trim();
      // console.log(imageDescription);
      return imageDescription;
    }

    const aiResponse = await processAttachment(attachmentPrompt, chatHistory);
    const botResponse = aiResponse;
    message.channel.send(botResponse);
    console.log(`${botNickname}: ${botResponse}`);
    fileManager.deleteFile(fileResult.file.name);
    return botResponse;

  } else if (mediaChannels.includes(channelId) && botCall && message.attachments.size > 0) {
    const attachmentPrompt = `${userName}: ${userMessage}`;
    const attachment = message.attachments.first();
    const dirtyUrl = attachment.url;
    const cleanUrl = cleanURL(dirtyUrl);
    const filename = path.basename(cleanUrl);
    const cleanFilename = path.parse(filename).name.toLowerCase()
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .replace(/_/g, '-') // Replace underscores with dashes
      .replace(/[^a-z0-9-]/g, ''); // Remove non-alphanumeric characters;
    const extension = path.extname(filename).toLowerCase();
    const filepath = "./temp/" + filename;
    await downloadFile(dirtyUrl, filepath);

    let mimeType;
    if (mimeTypes.hasOwnProperty(extension)) {
      mimeType = mimeTypes[extension];
    } else {
      const alternateExtension = extension.slice(1).toLowerCase(); // Remove leading dot
      if (mimeTypes.hasOwnProperty(alternateExtension)) {
        mimeType = mimeTypes[alternateExtension];
      } else {
        console.error(`Unsupported file type: ${filename}`);
        // Handle unsupported file
      }
    }

    function cleanURL(url) {
      // Use URL object to parse the URL
      const urlObject = new URL(url);
      // Return only the origin and pathname
      return urlObject.origin + urlObject.pathname;
    }
    
    function downloadFile(dirtyUrl, filepath) {
      return new Promise((resolve, reject) => {
        https.get(dirtyUrl, (res) => {
          const fileStream = fs.createWriteStream(filepath);
          res.pipe(fileStream);
      
          fileStream.on('finish', () => {
              fileStream.close();
              console.log('Attatchment downloaded.');
              resolve(); // Resolve the promise on successful download
          });
    
          fileStream.on('error', (error) => {
            reject(error); // Reject the promise on download error
          });
        })
      });
    }

    const fileResult = await fileManager.uploadFile(filepath, {
      mimeType: mimeType,
      // It will also add the necessary "files/" prefix if not provided
      name: "files/" + cleanFilename,
      displayName: cleanFilename
    });

    async function processAttachment(attachmentPrompt) {
      const text = `${botPersonality}### Current chat between ${botNickname} and the users in this channel. Do not imitate any of these users, just send what ${botNickname} would say. Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:`;
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: text },
            ],
          },
          {
            role: "user",
            parts: [
              { text: attachmentPrompt },
              {
                fileData: {
                  mimeType: fileResult.file.mimeType,
                  fileUri: fileResult.file.uri
                }
              },
            ],
          },
        ],
        generationConfig,
        safetySettings
      });
      const response = result.response;
      const imageDescription = response.text().trim();
      // console.log(imageDescription);
      return imageDescription;
    }

    const aiResponse = await processAttachment(attachmentPrompt);
    const botResponse = aiResponse;
    message.channel.send(botResponse);
    console.log(`${botNickname}: ${botResponse}`);
    fileManager.deleteFile(fileResult.file.name);
    return botResponse;

  } else if (allowedChannels.includes(channelId) && botCall && (!lastResponseTime[channelId])) { // botCall is replaced by allowedChannels for the moment
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
