import dotenv from 'dotenv'
import OpenAI from 'openai'
import { Client, Events, ActivityType, GatewayIntentBits } from 'discord.js'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
]})

const ping = {
  name: 'ping',
  description: 'Pings the bot and shows the latency.'
}

client.on('interactionCreate', (interaction) => {
  if (interaction.commandName === 'ping') {
    interaction.reply(`Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`)
  } else { // A response if you forget to add the command here.
    interaction.reply('Command unavailable.')
  }
})

const currentDate = new Date()
const dateString = currentDate.toLocaleString("en-US", { year: '2-digit', month: '2-digit', day: '2-digit', hour12: false, hour: '2-digit', minute: '2-digit' })
const chatTimestamp = currentDate.toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' })

// Set various bot statuses here. Modify to your preferences.
const statuses = [
  { status: `Distractible`, type: ActivityType.Listening },
  { status: `The WAN Show`, type: ActivityType.Listening },
  { status: `Linus Tech Tips`, type: ActivityType.Watching },
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
  const userName = message.member.nickname || message.author.username
  const userMessage = message.content
  const botNickname = message.guild.members.me.nickname || message.guild.members.me.user.username
  
  const guild = client.guilds.cache.get(guildId)
  const botNamesWithNicknames = []
  guild.members.cache.filter(member => member.user.bot).forEach(botMember => {
    const nickname = botMember.nickname
    const name = nickname ? nickname : botMember.user.username
    botNamesWithNicknames.push(name)
  })

  // This code snippet collects the last messages for context matching.
  const channel = message.channel
  const messages = await channel.messages.fetch({ limit: 12 }) // <- Number of messages will be collected for context matching.
  const messageArray = Array.from(messages.values()).reverse()
  const chatHistory = messageArray.map(msg => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.username : msg.author.username
    const historyTimestamp = new Date(msg.createdTimestamp).toLocaleString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' })
    return `${chatAuthor}: ${msg.content.replace(idPattern, "").trim()}`
  }).join('\n')

  // Set bot's personality. Modify to your preferences.
  const botPersonality = (`
    ${botNickname} is a sassy, though very smart and helpful Discord bot that reluctantly answers questions with sarcastic responses.
    It was created by Drie. Currently in #${channelName} channel in ${guildName} server at ${dateString}.
  `).replace(/^\s+/gm, '')
  
  // OpenAI text-completion model API call begins here. Modify to your preferences.
  async function generateResponse(botPersonality, chatHistory) {
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{"role": "system", "content": `${botPersonality}${chatHistory}\n${botNickname}:`}],
      temperature: 1,
      presence_penalty: 1,
      frequency_penalty: 1,
      stop: [`${userName}:`, `${botNickname}:`]
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
  } else if (Date.now() - lastResponseTime[channelId] <= attentionTime && userMessage.toLowerCase().includes('imagine')) {
    clearTimeout(chatWait)
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId)
      sendGeneratedImage(message)
      lastResponseTime[channelId] = Date.now()
      timeoutId = setTimeout(() => stopAttention(channelId), attentionTime)
    }, waitTime)
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
  }
})

client.login(process.env.TOKEN)
