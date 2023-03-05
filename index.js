require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')

const { Client, Collection, Events, ActivityType, GatewayIntentBits } = require('discord.js')
const { Configuration, OpenAIApi } = require("openai")

const currentDate = new Date()
const dateString = currentDate.toLocaleString("en-US", { year: '2-digit', month: '2-digit', day: '2-digit', hour12: false, hour: '2-digit', minute: '2-digit' })
const chatTimestamp = currentDate.toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' })

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
]})

const configuration = new Configuration({ apiKey: process.env.OPENAIKEY })
const openai = new OpenAIApi(configuration)

client.commands = new Collection()

const commandsPath = path.join(__dirname, 'commands')
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file)
  const command = require(filePath)
  //  Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command)
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return

  const command = interaction.client.commands.get(interaction.commandName)

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(error)
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
  }
})

// Set various bot statuses here. Modify to your preferences.
const statuses = [
  { status: `Distractible`, type: ActivityType.Listening },
  { status: `The WAN Show`, type: ActivityType.Listening },
  { status: `Bigfoot Collecters Club`, type: ActivityType.Listening },
  { status: `The Last of Us`, type: ActivityType.Watching },
  { status: `Linus Tech Tips`, type: ActivityType.Watching },
  { status: `Game Changer`, type: ActivityType.Watching },
  { status: `Hogwarts Legacy`, type: ActivityType.Playing },
  { status: `Destiny 2`, type: ActivityType.Playing },
  { status: `Escape from Tarkov`, type: ActivityType.Playing },
  { status: `Squid Game`, type: ActivityType.Competing },
]

function setBotStatus() {
  const randomIndex = Math.floor(Math.random() * statuses.length)
  const { status, type } = statuses[randomIndex]
  client.user.setActivity(status, { type })
}

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`)
  setBotStatus()
  setInterval(() => setBotStatus(), 30000) // <- Set interval of when the bot will change the status randomly (in ms).
})

// Initializes context matching variables for later use.
const lastResponseTime = {}
let chatWait
let timeoutId

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return

  const idPattern = /<@\d+>/g
  const guildId = message.guild.id
  const guildName = message.guild.name
  const channelId = message.channel.id
  const channelName = message.channel.name
  const userName = message.author.username
  const userMessage = message.content
  const botNickname = message.guild.members.me.nickname || message.guild.members.me.user.username

  // Set number of last hours of which messages will be pulled.
  const hours = 60 * 60 * 1000
  const hoursAgo = Date.now() - 6 * hours // <- Set it here.

  // This code snippet collects the last messages for context matching.
  const channel = message.channel
  const messages = await channel.messages.fetch({ limit: 11 }) // <- Number of messages will be collected for context matching.
    .then(messages => messages.filter(msg => msg.createdTimestamp >= hoursAgo))
  const messageArray = Array.from(messages.values()).reverse()
  const chatHistory = messageArray.map(msg => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.username : msg.author.username
    const historyTimestamp = new Date(msg.createdTimestamp).toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' })
    return `${historyTimestamp} ${chatAuthor}: ${msg.content.replace(idPattern, "").trim()}`
  }).join('\n')

  // Set bot's personality. Modify to your preferences.
  const botPersonality = (`
    ${botNickname} is a sassy, though very smart and helpful Discord bot that reluctantly answers questions with sarcastic responses.
    It was created by Drie. Currently in #${channelName} in server ${guildName} at ${dateString}.
  `).replace(/^\s+/gm, '')
  
  // OpenAI text-completion model API call begins here. Modify to your preferences.
  async function generateResponse(botPersonality, chatHistory) {
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{"role": "system", "content": `${botPersonality}${chatHistory}\n${chatTimestamp} ${botNickname}:`}],
      temperature: 1,
      presence_penalty: 1,
      frequency_penalty: 1
    })
    return gptResponse
  }

  // OpenAI Dall-E 2 model API call begins here. Modify to your preferences.
  async function generateImage(prompt) {
    const gptCreate = await openai.createImage({
      prompt: prompt,
      n: 1,
      size: "512x512",
    })
    const gptImage = gptCreate.data.data[0].url
    return gptImage
  }

  async function sendResponse(message) {
    console.log(`${userName}: ${userMessage}`)
    const gptResponse = await generateResponse(botPersonality, chatHistory)
    const botResponse = gptResponse.data.choices[0].message.content.trim()
    message.channel.send(botResponse)
    console.log(`${botNickname}: ${botResponse}`)
  }

  async function sendGeneratedImage(message) {
    let prompt = `${userMessage.toLowerCase().replace(idPattern, "").replace(botNickname.toLowerCase(), '').replace('imagine', '').trim()}`
    console.log(`\x1b[32mImagine prompt by ${userName} from ${guildName}: \n"${prompt}"\x1b[0m`)
    const gptImage = await generateImage(prompt)
    message.channel.send(gptImage)
  }

  function stopAttention(channelId) {
    lastResponseTime[channelId] = null
    console.log(`\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`)
  }

  // Set how the bot should be called to repond to messages. Modify to your preferences.
  const botCalled = userMessage.toLowerCase().includes(`${botNickname.toLowerCase()}`) || message.mentions.users.has(client.user.id)

  // Set how long the bot will pay attention to the channel (in ms).
  const attentionTime = 60000

  // Set how long the bot will wait for people to stop sending chat before replying (in ms).
  const waitTime = 3000

  if (botCalled && (!lastResponseTime[channelId]) && userMessage.toLowerCase().includes('imagine')) {
    clearTimeout(timeoutId)
    sendGeneratedImage(message)
    lastResponseTime[channelId] = Date.now()
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`)
    timeoutId = setTimeout(() => stopAttention(channelId), attentionTime)
  } else if (botCalled && (!lastResponseTime[channelId])) {
    clearTimeout(timeoutId)
    sendResponse(message)
    lastResponseTime[channelId] = Date.now()
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`)
    timeoutId = setTimeout(() => stopAttention(channelId), attentionTime)
  } else if (Date.now() - lastResponseTime[channelId] <= attentionTime) {
    clearTimeout(chatWait)
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId)
      sendResponse(message)
      lastResponseTime[channelId] = Date.now()
      timeoutId = setTimeout(() => stopAttention(channelId), attentionTime)
    }, waitTime)
  } else if (Date.now() - lastResponseTime[channelId] <= attentionTime && userMessage.toLowerCase().includes('imagine')) {
    clearTimeout(chatWait)
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId)
      sendGeneratedImage(message)
      lastResponseTime[channelId] = Date.now()
      timeoutId = setTimeout(() => stopAttention(channelId), attentionTime)
    }, waitTime)
  }
})

client.login(process.env.TOKEN)
