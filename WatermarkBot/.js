const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { REST, Routes } = require("discord.js");
const fs = require('fs');
const sharp = require('sharp');
const https = require('https');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { channelId, clientId, guildId, token } = require('./config/config.json');

const commands = [

    new SlashCommandBuilder()
        .setName('set-channel')
        .setDescription('Set a channel for specific operations.')
        .setDefaultMemberPermissions(0)
        .addChannelOption(option =>
            option.addChannelTypes(0)
                .setName('channel')
                .setDescription('The channel to set')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('set-watermark')
        .setDescription('Uploads a file and processes it.')
        .setDefaultMemberPermissions(0)
        .addAttachmentOption(option =>
            option.setName('file')
                .setRequired(true)
                .setDescription('The file to upload and process.')
        )
        .addBooleanOption(option =>
            option.setName('has-background')
                .setDescription('Does the image have a background?')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('set-opacity')
        .setDescription('Sets the opacity of the watermark.')
        .setDefaultMemberPermissions(0)
        .addNumberOption(option =>
            option.setName('opacity')
                .setDescription('The opacity value to set, between 0 and 1.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1)
        )

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

let targetChannelId = channelId;
let targetChannel;
const oldwatermarkPath = 'src/data/oldwatermark.png'
const watermarkPath = 'src/data/watermark.png'
const examplekPath = 'src/data/example.png';


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    targetChannel = client.channels.cache.get(channelId);
});



client.on('messageCreate', async message => {
    if (message.author.bot || message.channel.id !== targetChannelId) return;
    if (message.attachments.size > 0) {
        message.attachments.forEach(async attachment => {
            const tempDownloadPath = 'src/temp_image.png';

            const user = message.author;

            const fileStream = fs.createWriteStream(tempDownloadPath);
            const request = https.get(attachment.url, response => {
                response.pipe(fileStream);

                fileStream.on('finish', async () => {
                    fileStream.close();

                    const image = sharp(tempDownloadPath);
                    const imageMetadata = await image.metadata();

                    const watermark = sharp(watermarkPath).resize({
                        width: imageMetadata.width,
                        height: imageMetadata.height,
                        fit: 'fill' // Watermark'ı kırpma yapmadan esnet
                    });

                    image
                        .composite([{ input: await watermark.toBuffer(), blend: 'overlay' }])
                        .toFile('output.png')
                        .then(() => {
                            const attachment = new AttachmentBuilder('output.png');
                            let embed = new EmbedBuilder()
                                .setAuthor({ name: user.globalName, iconURL: user.avatarURL() })
                                .setImage('attachment://output.png')
                                .setColor('White')
                                .setTimestamp();

                            if (message.content.trim().length > 0) {
                                embed.setTitle(message.content);
                            }

                            message.channel.send({ embeds: [embed], files: [attachment] });
                            fs.unlinkSync(tempDownloadPath);
                            message.delete().catch(err => console.error('Mesaj silinirken hata oluştu:', err));
                        })
                        .catch(err => console.error('Sharp composite error:', err));
                });
            });

            request.on('error', error => {
                console.error('Error downloading the image:', error);
                fs.unlinkSync(tempDownloadPath);
            });
        });
    }
});





client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;


    if (interaction.commandName === 'set-watermark') {
        const fileAttachment = interaction.options.getAttachment('file');
        const hasBackground = interaction.options.getBoolean('has-background')

        interaction.deferReply()


        if (hasBackground) {

            // oldwatermark varsa sil
            fs.stat(oldwatermarkPath, (err, stats) => {
                if (!err && stats) {
                    fs.unlink(oldwatermarkPath, (err) => {
                        if (err) {
                            console.error(`Mevcut watermark dosyası silinirken hata oluştu: ${err}`);
                            return;
                        }
                        console.log('Mevcut watermark dosyası silindi.');
                        downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, true, interaction);
                    });
                } else {
                    downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, true, interaction);
                }
            });

            // watermark varsa sil
            fs.stat(watermarkPath, (err, stats) => {
                if (!err && stats) {
                    fs.unlink(watermarkPath, (err) => {
                        if (err) {
                            console.error(`Mevcut watermark dosyası silinirken hata oluştu: ${err}`);
                            return;
                        }
                        console.log('Mevcut watermark dosyası silindi.');
                        downloadAndSaveFile(fileAttachment.url, watermarkPath, true, interaction);
                    });
                } else {
                    downloadAndSaveFile(fileAttachment.url, watermarkPath, true, interaction);
                }
            });

        }
        else {

            // watermark varsa sil
            fs.stat(watermarkPath, (err, stats) => {
                if (!err && stats) {
                    fs.unlink(watermarkPath, (err) => {
                        if (err) {
                            console.error(`Mevcut watermark dosyası silinirken hata oluştu: ${err}`);
                            return;
                        }
                        console.log('Mevcut watermark dosyası silindi.');
                        downloadAndSaveFile(fileAttachment.url, watermarkPath, false, interaction);
                    });
                } else {
                    downloadAndSaveFile(fileAttachment.url, watermarkPath, false, interaction);
                }
            });

            // oldwatermark varsa sil
            fs.stat(oldwatermarkPath, (err, stats) => {
                if (!err && stats) {
                    fs.unlink(oldwatermarkPath, (err) => {
                        if (err) {
                            console.error(`Mevcut watermark dosyası silinirken hata oluştu: ${err}`);
                            return;
                        }
                        console.log('Mevcut watermark dosyası silindi.');
                        downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, false, interaction);
                    });
                } else {
                    downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, false, interaction);
                }
            });

        }

    }





    if (interaction.commandName === 'set-opacity') {
        const opacity = interaction.options.getNumber('opacity')

        if (opacity > 1 || opacity < 0) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle('opacity value can only be between 0 and 1!')
                .setColor('Red')
                .setTimestamp()

            interaction.reply({ embeds: [embed] })
            return
        }


        interaction.deferReply()

        adjustOpacityAndSave(opacity, interaction);
    }

    if (interaction.commandName === 'set-channel') {
        try {
            const channel = interaction.options.getChannel('channel');
            targetChannel = channel;
            targetChannelId = channel.id;


            const configPath = 'src/config/config.json';

            fs.readFile(configPath, 'utf8', (err, data) => {
                if (err) {
                    console.error('An error occurred while reading the file:', err);
                    return;
                }

                const config = JSON.parse(data);
                config.channelId = targetChannelId;

                fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('An error occurred while writing to the file:', err);
                        return;
                    }
                });
            });

            const embed2 = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle('Channel successfully set up for the bot!')
                .setColor('Green')
                .setTimestamp()

            interaction.reply({ embeds: [embed2] })

            const embed1 = new EmbedBuilder()
                .setAuthor({ name: interaction.user.globalName, iconURL: interaction.user.displayAvatarURL() })
                .setTitle('Bot is running !')
                .setColor('Green')
                .setTimestamp()

            channel.send({ embeds: [embed1] })
        } catch (error) {

        }
    }
})





function downloadAndSaveFile(url, filePath, hasBackground, interaction) {

    try {
        const file = fs.createWriteStream(filePath);
        https.get(url, async function (response) {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Yeni watermark dosyası kaydedildi.');
            });
            if (hasBackground) {
                await sleep(250)
                makeWhiteTransparent(filePath)
            }
            await sleep(3000)
            console.log('örnek resim oluşturuluyor')
            
            // --
            const user = interaction.user;
            
            const image = sharp(examplekPath);
            const imageMetadata = await image.metadata();

            const watermark = sharp(watermarkPath).resize({
                width: imageMetadata.width,
                height: imageMetadata.height,
                fit: 'fill'
            });

            image
                .composite([{ input: await watermark.toBuffer(), blend: 'overlay' }])
                .toFile('output.png')
                .then(async () => {
                    const attachment = new AttachmentBuilder('output.png');
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: user.globalName, iconURL: user.avatarURL() })
                        .setTitle('Example image:')
                        .setDescription('To change the opacity of the watermark,\nyou can use the /set-opacity command.')
                        .setImage('attachment://output.png')
                        .setColor('White')
                        .setTimestamp();

                    await sleep(1000)

                    interaction.editReply({ embeds: [embed], files: [attachment] });
                })
                .catch(err => console.error('Sharp composite error:', err));


        }).on('error', (err) => {
            fs.unlink(filePath); // İndirme hatası olursa dosyayı sil
            console.error(`Dosya indirilirken hata oluştu: ${err}`);
        });
    } catch (error) {

    }
}







async function adjustOpacityAndSave(opacity, interaction) {

    try {
        const image = sharp(oldwatermarkPath);
        const metadata = await image.metadata();

        image
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                for (let i = 0; i < data.length; i += info.channels) {
                    data[i + 3] = Math.round(data[i + 3] * opacity);
                }
                return sharp(data, {
                    raw: {
                        width: info.width,
                        height: info.height,
                        channels: info.channels,
                    },
                }).toFile(watermarkPath);
            })
            .then(async () => {
                console.log('Opaklık ayarlandı ve dosya üzerine yazıldı.');

                // --
                const user = interaction.user;

                const image = sharp(examplekPath);
                const imageMetadata = await image.metadata();

                const watermark = sharp(watermarkPath).resize({
                    width: imageMetadata.width,
                    height: imageMetadata.height,
                    fit: 'fill'
                });

                image
                    .composite([{ input: await watermark.toBuffer(), blend: 'overlay' }])
                    .toFile('output.png')
                    .then(async () => {
                        const attachment = new AttachmentBuilder('output.png');
                        const embed = new EmbedBuilder()
                            .setAuthor({ name: user.globalName, iconURL: user.avatarURL() })
                            .setTitle('Example image:')
                            .setImage('attachment://output.png')
                            .setColor('White')
                            .setTimestamp();

                        await sleep(1000)

                        interaction.editReply({ embeds: [embed], files: [attachment] });
                    })
                    .catch(err => console.error('Sharp composite error:', err));


            })
            .catch(err => {
                console.error('Hata:', err);
            });
    } catch (error) {

    }
}





// background silme 
async function makeWhiteTransparent(inputImagePath) {

    try {

        const image = sharp(inputImagePath);
        const metadata = await image.metadata();
        const threshold = 245;

        return image
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                for (let i = 0; i < data.length; i += info.channels) {
                    if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                        data[i + 3] = 0;
                    }
                }
                return sharp(data, {
                    raw: {
                        width: info.width,
                        height: info.height,
                        channels: info.channels,
                    },
                }).toFile(inputImagePath);
            })
            .then(() => {
                console.log('İşlem tamamlandı.');


            })
            .catch(err => {
                console.error('Hata:', err);
            });
    } catch (error) {

    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


client.login(token);