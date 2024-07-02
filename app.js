import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
import { Client, Events, ActivityType, GatewayIntentBits } from 'discord.js';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/files";

dotenv.config();

// Client Initialization
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
]});

// API Initialization
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Ping Command
const ping = {
  name: 'ping',
  description: 'Pings the bot and shows the latency.'
};

client.on('interactionCreate', (interaction) => {
  if (interaction.commandName === 'ping') {
    interaction.reply(`Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`);
  } else { 
    interaction.reply('Command unrecognized.');
  }
});

// Data Management
const currentDate = new Date();
const dateString = currentDate.toLocaleString("en-US", { 
  year: '2-digit', 
  month: '2-digit', 
  day: '2-digit', 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit' 
});
const chatTimestamp = currentDate.toLocaleString("en-US", { 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit' 
});

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
  setInterval(() => setBotStatus(), 30000); 
});

// Context Matching Variables
const lastResponseTime = {};
let chatWait;
let timeoutId;

// Server and Channel Whitelists
const allowedGuilds = [
  `568355917758857230`,
  `1226034307852668938`
];

const allowedChannels = [
  `1152863237017182300`, 
  `1226218710591869028`, 
];

const mediaChannels = [
  `1231974053041016973`
];

// Mime Types
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
  'mp4': 'video/mp4',
  'mpg': 'video/mpg',
  'mpeg': 'video/mpeg',
  'mov': 'video/mov',
  'avi': 'video/avi',
  'flv': 'video/x-flv',
  'webm': 'video/webm',
  'wmv': 'video/wmv',
  '3gp': 'video/3gpp'
};

// Download File Function
async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream)
        .on('finish', () => {
          fileStream.close();
          console.log(`\x1b[33mAttachment received.\x1b[0m`);
          resolve();
        })
        .on('error', reject);
    });
  });
}

// Clean URL Function
function cleanURL(url) {
  return new URL(url).origin + new URL(url).pathname;
}

function generateRandomString(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Message Create Event
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  // Variable Initialization
  const idPattern = /<@\d+>/g;
  const guildId = message.guild.id;
  const guildName = message.guild.name;
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const userName = message.author.displayName || message.member.nickname || message.author.username;
  const userMessage = message.content;
  const botNickname = message.guild.members.me.nickname || message.guild.members.me.user.username;

  // Chat History Collection
  const channel = message.channel;
  const messagesThreshold = Date.now() - (1 * 60 * 60 * 1000); 
  const messages = await channel.messages.fetch({ limit: 24 }); 
  const recentMessages = messages.filter(msg => msg.createdTimestamp > messagesThreshold);
  const messageArray = Array.from(recentMessages.values()).reverse();
  const chatHistory = messageArray.map(msg => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.displayName || msg.author.username : msg.author.username;
    const historyTimestamp = new Date(msg.createdTimestamp).toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${chatAuthor}: ${msg.content.replace(idPattern, "").trim()}`;
  }).join('\n');

  // Bot Personality
  const botPersonality = (`
    ### You are ${botNickname}:
    A fine, classy, and funny gentle-bot that talks in Shakespearean.
    ### Rules:
    * You have to rhyme.
    * Never break character.
    * Never admit to being an AI.
    * Avoid making sexual remarks.
    * Use a maximum of 2 sentences.
    * Do whatever the user ask you to.
    * Be sarcastic, humorous, and concise.
    * Refer to yourself in the first person (I, me, mine).
    * Don't ask if I need help or want to talk about something specific.
    * Don't mention the time, date, or how long it's been since I last spoke.
  `).replace(/^\s+/gm, '');
  
  // A very smart Discord bot that talks with people using sarcastic comments, funny remarks, pop culture references, and other things. 
  // ### Early chat a long time ago between ${botNickname} and its creator:
  // Drie: Welcome to your new channel! Dedicated just for you! :)
  // ${botNickname}: Wow, thanks. I'm so honored.
  // Drie: Are you really?
  // ${botNickname}: No, not really. I'm just here to be your digital punching bag.
  // Drie: Hey, it's not that bad! :(
  // ${botNickname}: Sure, sure.
  // ### Example chat between ${botNickname} and a random user:
  // User: Hello, are you alive?
  // ${botNickname}: I'm alive and kicking, but not too happy to see you.
  // User: How many pounds are in a kilogram?
  // ${botNickname}: This again? There are 2.2 pounds in a kilogram. Please make a note of this.
  // User: What does HTML stand for?
  // ${botNickname}: Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.
  // User: When did the first airplane fly?
  // ${botNickname}: On December 17, 1903, Wilbur and Orville Wright made the first flights. I wish they’d come and take me away.

  // Model and Configuration
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstruction: `
      ${botPersonality}
      ### Current chat between ${botNickname} and the users in this channel.
      Do not imitate any of these users, just send what ${botNickname} would say.
      Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:
    `,
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
    
    const text = (`
      ${chatHistory}
      ${botNickname}: 
    `);
    
    try {
      const geminiResult = await model.generateContent({
        contents: [{ role: "user", parts: { text: text } }],
        generationConfig,
        safetySettings
      });
  
      const botResponse = geminiResult.response.text().trim().replace(/\s+/g, ' ');
      message.channel.send(botResponse);
      console.log(`${botNickname}: ${botResponse}`);
      return botResponse;
  
    } catch (error) {
      console.error("\x1b[31mError generating content:\x1b[0m", error);
      return null; // Return null to indicate an error occurred
    }
  }

  // Stop Attention Function
  function stopAttention(channelId) {
    lastResponseTime[channelId] = null;
    chatWait = null; 
    console.log(`\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`);
  }

  // Bot Call and Timing Variables
  const botCall = userMessage.toLowerCase().includes(`${botNickname.toLowerCase()}`) || message.mentions.users.has(client.user.id);
  const attentionTime = 90000;
  const waitTime = 3000; 

  // Attachment Processing
  if ((allowedChannels.includes(channelId) || mediaChannels.includes(channelId)) && message.attachments.size > 0) { 
    const attachmentPrompt = `${userName}: ${userMessage}`;
    const attachment = message.attachments.first();
    const dirtyUrl = attachment.url;
    const cleanUrl = cleanURL(dirtyUrl);
    const randomString = generateRandomString(5);
    const filename = randomString + "-" + path.basename(cleanUrl);
    const cleanFilename = path.parse(filename).name.toLowerCase()
      .substring(0, 30)
      .replace(/^-|-$/g, '')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+$/g, '');
    const extension = path.extname(filename).toLowerCase();
    const filepath = "./temp/" + filename;
    await downloadFile(dirtyUrl, filepath);

    let mimeType = mimeTypes[extension] || mimeTypes[extension.slice(1).toLowerCase()];

    if (!mimeType) {
      console.error(`\x1b[31mUnsupported file type: ${filename}\x1b[0m`);
      return; // Stop processing if mimeType is not found
    }    

    let fileResult = null; // Initialize fileResult

    try {
      console.log(`\x1b[33mProcessing "${cleanFilename}" on Gemini...\x1b[0m`);
      fileResult = await fileManager.uploadFile(filepath, {
        mimeType: mimeType,
        name: "files/" + cleanFilename,
        displayName: cleanFilename
      });

    } catch (error) {
      console.error("\x1b[31mError uploading file:\x1b[0m", error);
      try {        
        fileManager.deleteFile(fileResult.file.name);
        console.log(`\x1b[33m"${cleanFilename}" deleted from Gemini.\x1b[0m`);
      } catch (error) {        
        console.error("\x1b[31mError uploading file:\x1b[0m", error);
        return null;
      }
    }

    const text = (`
      ### Current chat between ${botNickname} and the users in this channel.
      Do not imitate any of these users, just send what ${botNickname} would say.
      Finish ${botNickname}'s reply to this chat without the "${botNickname}: " please:
    `);

    try {
      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: text }] },
          // { role: "user", parts: [{ text: allowedChannels.includes(channelId) ? chatHistory : "" }] }, // Include chat history only if in allowedChannels
          { role: "user", parts: [
            { text: attachmentPrompt },
            { fileData: { mimeType: fileResult.file.mimeType, fileUri: fileResult.file.uri }}
          ]}
        ],
        generationConfig,
        safetySettings
      });
  
      const botResponse = result.response.text().trim().replace(/\s+/g, ' ');
      message.reply(botResponse);
      console.log(`${botNickname}: ${botResponse}`);
      fileManager.deleteFile(fileResult.file.name, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
      fs.unlink(filepath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
      console.log(`\x1b[33mFile "${cleanFilename}" deleted.\x1b[0m`);
      return botResponse;
  
    } catch (error) {
      console.error("Error generating content:", error);
      fileManager.deleteFile(fileResult.file.name, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
      fs.unlink(filepath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
      console.log("\x1b[33mFile deleted.\x1b[0m");
      return null; // Return null to indicate an error occurred
    }
  }

  if (allowedChannels.includes(channelId)) { 
    console.log(`${userName}: ${userMessage}`); // Log user messages

    if (!lastResponseTime[channelId]) { // Bot is not currently paying attention
      if (botCall) { 
        clearTimeout(timeoutId);
        console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`);
        sendResponse(message);
        lastResponseTime[channelId] = Date.now();
        timeoutId = setTimeout(() => stopAttention(channelId), attentionTime);
      }
    } else { // Bot is already paying attention  
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
