const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { clientId, guildId, token, sheetName } = require('./config/config.json');

const commands = [

    new SlashCommandBuilder()
        .setName('refresh-emoji')
        .setDescription('refresh-emoji'),

    new SlashCommandBuilder()
        .setName('set-sheet-name')
        .setDescription('Name of the sheet')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Enter a name')
                .setRequired(true)),


    new SlashCommandBuilder()
        .setName('cards')
        .setDescription('Sends text to the Claude model for processing.')
        .addStringOption(option =>
            option.setName('card')
                .setDescription('Select a card')
                .setRequired(true)
                .setAutocomplete(true)),

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

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let array;
let sheetNameG = sheetName

client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;
    try {
        if (interaction.commandName === 'cards') {
            let focusedValue = interaction.options.getFocused();
            if (focusedValue == '') {
                focusedValue = 'a'
            }
            let choices = await getChoices(focusedValue);

            await interaction.respond(choices);
        }
    } catch (error) {
        console.error('Bir hata meydana geldi:', error);
    }
});

//#region   --- FUNCTIONS ----

async function getChoices(focusedValue) {

    const auth = new google.auth.GoogleAuth({
        keyFile: 'src/data/sheet_data.json',
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = '1nuV1v4K0dS2pXmJW2LWQZxfyJ4bPxgrct63-gKfu7qo';
    const range = `${sheetNameG}!A2:A550`;
    const response = await googleSheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    array = response.data.values

    const choices = response.data.values
        .filter(item => item.length > 0 && item[0] && item[0].toLowerCase().includes(focusedValue.toLowerCase()))
        .map(item => ({ name: item[0], value: item[0] }));

    return choices.slice(0, 25);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let emojis = []

async function amk() {
    const guilds = await client.guilds.fetch();
    guilds.forEach(async guild => {
        const guild1 = await client.guilds.fetch(guild.id);
        emojis.push(await guild1.emojis.fetch())
    });
    await sleep(1000)
    return emojis;
}

async function findEmojiByName(emojis, emojiName) {
    emojiName = emojiName.toLowerCase().replace(/\s/g, '');
    for (const emojiCollection of emojis) {
        for (const emoji of emojiCollection.values()) {
            if (emoji.name.toLowerCase() === emojiName) {
                return emoji;
            }
        }
    }
    return null;
}

//#endregion   --- FUNCTIONS ----


client.on('messageCreate', async message => {

    if (message.content === '!RenameCardImages') {
        try {
            const directoryPath = path.join(__dirname, 'data', 'cardImages');

            fs.readdir(directoryPath, (err, files) => {
                if (err) {
                    throw err;
                }

                files.forEach(file => {
                    if (file.endsWith('.png')) {
                        const filePath = path.join(directoryPath, file);
                        const newFileName = file.replace(/\s+/g, '');
                        const newFilePath = path.join(directoryPath, newFileName);

                        fs.rename(filePath, newFilePath, err => {
                            if (err) {
                                throw err;
                            }
                            console.log(`${file} successfully renamed to ${newFileName}.`);
                        });
                    }
                });
            });
        } catch (error) {
            console.error('An error occurred while processing images:', error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isCommand()) return

        if (interaction.commandName === 'refresh-emoji') {
            await interaction.guild.emojis.fetch()

            const embed = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle('Operation Successful')
                .setColor('Green')
                .setTimestamp()

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (interaction.commandName === 'set-sheet-name') {
            const target = interaction.options.getString('name')


            const configPath = 'src/config/config.json';
            fs.readFile(configPath, 'utf8', (err, data) => {
                if (err) {
                    console.error('An error occurred while reading the file:', err);
                    return;
                }

                const config = JSON.parse(data);
                config.sheetName = target;
                sheetNameG = target

                fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('An error occurred while writing to the file:', err);
                        return;
                    }
                });
            });

            const embed = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle('Operation Successful')
                .setColor('Green')
                .setTimestamp()

            await interaction.reply({ embeds: [embed], ephemeral: true });

        }

        if (interaction.commandName === 'cards') {
            const target = interaction.options.getString('card')

            interaction.deferReply()

            const index = (array.findIndex(element => element[0].toLowerCase() === target.toLowerCase())) + 2;
            if (index === -1) {
                console.error('Error: Requested value not found in the array.');
                interaction.reply({ content: 'The card you were looking for could not be found', ephemeral: true })
                return
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: 'src/data/sheet_data.json',
                scopes: 'https://www.googleapis.com/auth/spreadsheets',
            });

            const client = await auth.getClient();
            const googleSheets = google.sheets({ version: 'v4', auth: client });
            const spreadsheetId = '1nuV1v4K0dS2pXmJW2LWQZxfyJ4bPxgrct63-gKfu7qo';
            const range = `${sheetNameG}!A${index}:N${index}`; 
            const response = await googleSheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rangeName = `${sheetNameG}!A1:N1`
            const responseName = await googleSheets.spreadsheets.values.get({
                spreadsheetId,
                range: rangeName,
            });

            let tittleValue = response.data.values[0][0]
            const emojiName = tittleValue;

            let emojis = await amk()
            await sleep(100)

            let emoji = await findEmojiByName(emojis, emojiName)
            await sleep(200)

            if (emoji) {
                tittleValue = `${emoji.toString()}${tittleValue}`;
            }

            let embed = new EmbedBuilder()
                .setTimestamp()
                .setTitle(tittleValue)

            const values = response.data.values[0];
            for (let i = 1; i < 21; i++) {
                let value = values[i];
                const fieldName = responseName.data.values[0][i];
                if (fieldName === 'color' || fieldName === 'Color' || fieldName === 'COLOR') {
                    if (value === 'Colorless') {
                        embed.setColor('White')
                    }
                    else {
                        const substring = value.split(';')[0];
                        const color = substring.charAt(0).toUpperCase() + substring.slice(1);
                        embed.setColor(color)
                    }
                }
                if (value) {
                    if (fieldName === 'Color') {

                        if (value.includes(';')) {
                            let colors = value.split(';').map(v => v.trim());

                            value = ""
                            for (let color of colors) {
                                const emojiName = `${fieldName}_${color}`;

                                let emoji = await findEmojiByName(emojis, emojiName)
                                await sleep(200)

                                if (emoji) {
                                    value += `${emoji.toString()}` + " " + color
                                } else {
                                    value += " " + color
                                }
                            }
                        } else {
                            const emojiName = `${fieldName}_${value}`;

                            let emoji = await findEmojiByName(emojis, emojiName)
                            await sleep(200)

                            if (emoji) {
                                value = `${emoji.toString()}` + value
                            }
                        }

                        embed.addFields(
                            { name: fieldName, value: value.toString(), inline: false },
                        );
                    }
                    else {
                        if (value.includes(';')) {
                            let parts = value.split(';').map(v => v.trim());

                            value = ""
                            for (let part of parts) {
                                const emojiName = `${fieldName}_${part}`;

                                let emoji = await findEmojiByName(emojis, emojiName)
                                await sleep(200)

                                if (emoji) {
                                    value += `${emoji.toString()}` + part
                                } else {
                                    value += part
                                }
                            }
                        } else {
                            const emojiName = `${fieldName}_${value}`;

                            let emoji = await findEmojiByName(emojis, emojiName)
                            await sleep(200)

                            if (emoji) {
                                value = `${emoji.toString()}` + value
                            }
                        }
                        embed.addFields(
                            { name: fieldName, value: value.toString(), inline: false },
                        );
                    }
                }
            }

            let targetImage = response.data.values[0][0];
            targetImage = targetImage.replace(/\s+/g, '');
            const directoryPath = path.join(__dirname, 'data', 'cardImages');

            fs.readdir(directoryPath, async (err, files) => {
                if (err) {
                    console.error('An error occurred while reading the directory:', err);
                    return;
                }

                const imageName = files.find(file => file.toLowerCase() === `${targetImage.toLowerCase()}.png`);

                if (imageName) {
                    console.log("\n" + `Bulunan dosya: ${imageName}` + "\n");

                    const filePath = path.join(directoryPath, imageName);
                    const attachment = new AttachmentBuilder(filePath, { name: imageName });

                    embed.setImage(`attachment://${imageName}`)

                    await interaction.editReply({ embeds: [embed], files: [attachment] });

                } else {
                    console.log(`The file named ${targetImage} could not be found.`);
                    await interaction.editReply({ embeds: [embed] });
                }
            });
        }
    } catch (error) {
        console.error('An error occurred while processing the interaction:', error);
        await interaction.editReply({ content: 'An error occurred while processing your request', ephemeral: true });
    }
})

client.login(token)