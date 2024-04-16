
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const { Buffer } = require('buffer');
const axios = require('axios');
const pdf = require('pdf-parse');
const Anthropics = require('@anthropic-ai/sdk');

let base64Data;
let fileType;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { clientId, guildId, token, apiKeyCode } = require('./config/config.json');

const commands = [

    new SlashCommandBuilder()
        .setName('claude')
        .setDescription('Sends text to the Claude model for processing.')
        .addStringOption(option =>
            option
                .setName('text')
                .setDescription('The text to be processed by the Claude model.')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('Summarizes the recent messages in the selected channel.')
        .addChannelOption(option =>
            option.addChannelTypes(0)
                .setName('channel')
                .setDescription('The channel to summarize messages from.')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('sentiment')
        .setDescription('Analyzes the sentiment of the recent messages in the selected channel.')
        .addChannelOption(option =>
            option.addChannelTypes(0)
                .setName('channel')
                .setDescription('The channel whose messages to analyze sentiment for.')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Uploads a file and processes it.')
        .addAttachmentOption(option =>
            option.setName('file')
                .setRequired(true)
                .setDescription('The file to upload and process.')),

    new SlashCommandBuilder()
        .setName('summarizedoc')
        .setDescription('To extract the summary of the uploaded file.'),

    new SlashCommandBuilder()
        .setName('sentimentdoc')
        .setDescription('To perform sentiment analysis on the uploaded file.')

].map(command => command);

const rest = new REST({ version: '10' }).setToken(token);

async function command() {
    try {
        console.log('---Started refreshing application (/) commands.---');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('---Successfully reloaded application (/) commands for the guild.---');
    } catch (error) {
        console.error(error);
    }
}
command();

const client1 = new Anthropics({
    apiKey: apiKeyCode,
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});


const fetchMessages = async (channel, limit) => {
    const batchLimit = 100;
    let lastId = null;
    let totalFetched = 0;
    let messages = [];

    try {
        while (totalFetched < limit) {
            const fetchCount = Math.min(limit - totalFetched, batchLimit);
            const fetchedMessages = await channel.messages.fetch({ limit: fetchCount, before: lastId });

            if (fetchedMessages.size === 0) {
                break;
            }

            messages = messages.concat(Array.from(fetchedMessages.values()));
            totalFetched += fetchedMessages.size;
            lastId = fetchedMessages.last().id;
        }
    } catch (error) {
        console.error('An error occurred while fetching messages:', error);
        throw error;
    }

    return messages;
};

client.on('interactionCreate', async interaction => {
    try {

        if (!interaction.isCommand()) return;

        if (interaction.commandName === 'claude') {
            const text = interaction.options.getString('text')

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();


            const message = await interaction.reply({ embeds: [embed] });
            try {
                const apiResponse = await client1.messages.create({
                    model: "claude-3-opus-20240229",
                    max_tokens: 1000,
                    temperature: 0.0,
                    messages: [
                        { role: "user", content: text }
                    ]
                });

                console.log(apiResponse.content);
                await message.edit({ embeds: [], content: apiResponse.content[0].text });
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }



        if (interaction.commandName === 'summarize') {
            const channel = interaction.options.getChannel('channel');
            const channelId = channel.id

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();


            const message = await interaction.reply({ embeds: [embed] });

            try {
                const channel = await client.channels.fetch(channelId);
                const messages = await fetchMessages(channel, 250);

                // const messageCount = messages.size;

                const messageContent = messages.map(message => message.content).join(' ') + ' Extract the summary of these messages. Even though it may not make sense, summarize it.';

                const apiResponse = await client1.messages.create({
                    model: "claude-3-opus-20240229",
                    max_tokens: 1000,
                    temperature: 0.5,
                    messages: [
                        { role: "user", content: messageContent }
                    ]
                });

                await message.edit({ embeds: [], content: apiResponse.content[0].text });
            } catch (error) {
                console.error("Error sending message:", error);
                await message.edit({ embeds: [], content: 'An error occurred while summarizing the messages.' });
            }
        }



        if (interaction.commandName === 'sentiment') {
            const channel = interaction.options.getChannel('channel');
            const channelId = channel.id

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();


            const message = await interaction.reply({ embeds: [embed] });

            try {
                const channel = await client.channels.fetch(channelId);
                const messages = await fetchMessages(channel, 250);

                const messageCount = messages.size;

                const messageContent = messages.map(message => message.content).join(' ') + ' Perform a general sentiment analysis of these messages.';

                const apiResponse = await client1.messages.create({
                    model: "claude-3-opus-20240229",
                    max_tokens: 1000,
                    temperature: 0.5,
                    messages: [
                        { role: "user", content: messageContent }
                    ]
                });

                await message.edit({ embeds: [], content: apiResponse.content[0].text });
            } catch (error) {
                console.error("Error sending message:", error);
                await message.edit({ embeds: [], content: 'An error occurred while summarizing the messages.' });
            }
        }



        if (interaction.commandName === 'upload') {

            const fileAttachment = interaction.options.getAttachment('file');
            const url = fileAttachment.url;
            const fileName = fileAttachment.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();
            fileType = fileExtension;

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();

            const message = await interaction.reply({ embeds: [embed] });

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Green')
                .setTitle('Upload Successful')
                .setDescription('The upload has been successfully completed.')
                .setTimestamp();

            if (fileType === 'png' || fileType === 'jpg' || fileType === 'jpeg') {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);
                    const base64 = buffer.toString('base64');
                    base64Data = base64;

                    message.edit({ embeds: [successEmbed], ephemeral: false });

                } catch (error) {
                    console.error('File download or conversion error:', error);
                    await message.edit({ embeds: [], content: 'An error occurred while processing the file.' });
                }
            }
            else if (fileType === 'pdf') {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);

                    pdf(buffer).then(function (data) {
                        base64Data = data.text
                    });

                    message.edit({ embeds: [successEmbed], ephemeral: false });

                } catch (error) {
                    console.error('PDF download or processing error:', error);
                    await message.edit({ embeds: [], content: 'An error occurred while processing the PDF file.' });
                }
            }
            else if (fileType === 'txt') {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const textData = Buffer.from(response.data, 'binary').toString('utf8');
                    base64Data = textData

                    message.edit({ embeds: [successEmbed], ephemeral: false });
                } catch (error) {
                    console.error('Text file download or processing error:', error);
                    await message.edit({ embeds: [], content: 'An error occurred while processing the text file.' });
                }
            }
            else if (fileType === 'json') {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const textData = Buffer.from(response.data, 'binary').toString('utf8');
                    base64Data = textData;

                    message.edit({ embeds: [successEmbed], ephemeral: false });
                } catch (error) {
                    console.error('JSON file download or processing error:', error);
                    await message.edit({ embeds: [], content: 'An error occurred while processing the JSON file.' });
                }
            }
            else {
                const fileTypeErrorEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                    .setColor('Yellow')
                    .setTitle('Invalid File Type')
                    .setDescription('You can only upload **.png, .jpg, .jpeg, .pdf, .json,** and **.txt** files.')
                    .setTimestamp();

                message.edit({ embeds: [fileTypeErrorEmbed], ephemeral: false })
            }

        }



        if (interaction.commandName === 'summarizedoc') {

            if (base64Data === null || base64Data === undefined) {
                const errorEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                    .setColor('Red')
                    .setTitle('Processing Failed')
                    .setDescription('The operation has failed: File not found. Please check the file URL or permissions and try again.')
                    .setTimestamp();
                await interaction.reply({ embeds: [errorEmbed] });
                return
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();

            const message = await interaction.reply({ embeds: [embed] });

            if (fileType === 'pdf' || fileType === 'txt' || fileType === 'json') {
                try {
                    base64Data += "Can you summarize this document?"
                    const apiResponse = await client1.messages.create({
                        model: "claude-3-opus-20240229",
                        max_tokens: 4096,
                        temperature: 0.5,
                        messages: [
                            { role: "user", content: base64Data }
                        ]
                    });
                    await message.edit({ embeds: [], content: apiResponse.content[0].text });
                } catch (error) {
                    console.error(error)
                    const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                        .setColor('Red')
                        .setTitle('Processing Failed')
                        .setDescription('The operation has failed: The file size is too large. Please try again with a smaller file.(max 5MB)')
                        .setTimestamp();
                    await message.edit({ embeds: [errorEmbed] });
                }
            }

            if (fileType === 'png' || fileType === 'jpg' || fileType === 'jpeg') {

                try {

                    let mediaType;
                    switch (fileType) {
                        case 'png':
                            mediaType = 'image/png';
                            break;
                        case 'jpg':
                        case 'jpeg':
                            mediaType = 'image/jpeg';
                            break;
                        default:
                            mediaType = 'application/octet-stream';
                    }

                    const apiResponse = await client1.messages.create({
                        model: "claude-3-opus-20240229",
                        max_tokens: 1024,
                        messages: [
                            {
                                "role": "user", "content": [
                                    {
                                        "type": "image",
                                        "source": {
                                            "type": "base64",
                                            "media_type": mediaType,
                                            "data": base64Data
                                        }
                                    },
                                    { "type": "text", "text": "Can you summarize this document?" }
                                ]
                            }
                        ]
                    })
                    await message.edit({ embeds: [], content: apiResponse.content[0].text });
                } catch (error) {
                    console.error("Error sending message:", error);
                    const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                        .setColor('Red')
                        .setTitle('Processing Failed')
                        .setDescription('The operation has failed: The file size is too large. Please try again with a smaller file.(max 5MB)')
                        .setTimestamp();
                    await message.edit({ embeds: [errorEmbed] });
                }

            }
        }



        if (interaction.commandName === 'sentimentdoc') {

            if (base64Data === null || base64Data === undefined) {
                const errorEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                    .setColor('Red')
                    .setTitle('Processing Failed')
                    .setDescription('The operation has failed: File not found. Please check the file URL or permissions and try again.')
                    .setTimestamp();
                await interaction.reply({ embeds: [errorEmbed] });
                return
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                .setColor('Blue')
                .setTitle('Processing Started')
                .setDescription('This operation may take some time, please wait...')
                .setTimestamp();

            const message = await interaction.reply({ embeds: [embed] });

            if (fileType === 'pdf' || fileType === 'txt' || fileType === 'json') {
                try {
                    base64Data += "Could you analyze the sentiment of this document or perform sentiment analysis on this document?"
                    const apiResponse = await client1.messages.create({
                        model: "claude-3-opus-20240229",
                        max_tokens: 1024,
                        temperature: 0.5,
                        messages: [
                            { role: "user", content: base64Data }
                        ]
                    });
                    await message.edit({ embeds: [], content: apiResponse.content[0].text });
                } catch (error) {
                    console.error(error)
                    const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                        .setColor('Red')
                        .setTitle('Processing Failed')
                        .setDescription('The operation has failed: The file size is too large. Please try again with a smaller file.(max 5MB)')
                        .setTimestamp();
                    await message.edit({ embeds: [errorEmbed] });
                }
            }



            if (fileType === 'png' || fileType === 'jpg' || fileType === 'jpeg') {

                try {

                    let mediaType;
                    switch (fileType) {
                        case 'png':
                            mediaType = 'image/png';
                            break;
                        case 'jpg':
                        case 'jpeg':
                            mediaType = 'image/jpeg';
                            break;
                        default:
                            mediaType = 'application/octet-stream';
                    }

                    const apiResponse = await client1.messages.create({
                        model: "claude-3-opus-20240229",
                        max_tokens: 1024,
                        messages: [
                            {
                                "role": "user", "content": [
                                    {
                                        "type": "image",
                                        "source": {
                                            "type": "base64",
                                            "media_type": mediaType,
                                            "data": base64Data
                                        }
                                    },
                                    { "type": "text", "text": "Could you analyze the sentiment of this document or perform sentiment analysis on this document?" }
                                ]
                            }
                        ]
                    })
                    await message.edit({ embeds: [], content: apiResponse.content[0].text });
                } catch (error) {
                    console.error("Error sending message:", error);
                    const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Claude AI', iconURL: client.user.displayAvatarURL() })
                        .setColor('Red')
                        .setTitle('Processing Failed')
                        .setDescription('The operation has failed: The file size is too large. Please try again with a smaller file.(max 5MB)')
                        .setTimestamp();
                    await message.edit({ embeds: [errorEmbed] });

                }

            }
        }

    } catch (error) {
        console.error('An error occurred:', error);
        await interaction.reply({ content: 'An error occurred, the operation could not be completed.', ephemeral: true });
    }
})

client.login(token); 