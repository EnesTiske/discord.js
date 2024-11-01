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

let { channels, clientId, guildId, token, webhookUrl } = require('./config/config.json');
const { channel } = require('diagnostics_channel');

const commands = [

    new SlashCommandBuilder()
        .setName('add-channel')
        .setDescription('Add a channel for specific operations.')
        .setDefaultMemberPermissions(0)
        .addChannelOption(option =>
            option.addChannelTypes(0)
                .setName('a-channel')
                .setDescription('The channel to add')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('remove-channel')
        .setDescription('Remove a channel for specific operations.')
        .setDefaultMemberPermissions(0)
        .addChannelOption(option =>
            option.addChannelTypes(0)
                .setName('r-channel')
                .setDescription('The channel to remove')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('active-channel')
        .setDescription('List of active channels.')
        .setDefaultMemberPermissions(0),

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
            option.setName('remove-background')
                .setDescription('Would you like the white background to be removed?')
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

let channelsGlobal = channels
const oldwatermarkPath = './data/oldwatermark.png'
const watermarkPath = './data/watermark.png'
const examplekPath = './data/example.png';

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

});


client.on('messageCreate', async message => {
    if (message.author.bot || !channelsGlobal.some(channel => channel.id === message.channel.id)) return;
    if (message.attachments.size > 0) {

        const processingPromises = [];
        const matchedChannel = channelsGlobal.find(channel => channel.id === message.channel.id);
        
        if (!matchedChannel) {
            return
        }


        blobList = [];
        for (const attachment of message.attachments.values()) {
            if (!(attachment.name.endsWith('.webp') || attachment.name.endsWith('.png') || attachment.name.endsWith('.jpg') || attachment.name.endsWith('.jpeg')) || !(attachment.contentType == 'image/png' || attachment.contentType == 'image/jpeg' || attachment.contentType == 'image/jpg' || attachment.contentType == 'image/webp')) {
                continue;
            }

            const promise = new Promise((resolve, reject) => {
                https.get(attachment.url, response => {
                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', async () => {
                        try {
                            const imageBuffer = Buffer.concat(chunks);
                            const image = sharp(imageBuffer);
                            const imageMetadata = await image.metadata();

                            const watermark = sharp(watermarkPath)
                                .resize({
                                    width: imageMetadata.width,
                                    height: imageMetadata.height,
                                    fit: 'fill'
                                })
                                .toColourspace('rgba')


                            const watermarkedImageBuffer = await image
                                .composite([{ input: await watermark.toBuffer(), blend: 'over' }])
                                .toBuffer();


                            // // -- test için --
                            // await sharp(watermarkedImageBuffer).toFile('output.png');
                            // resolve('output.png');

                            const blob = new Blob([watermarkedImageBuffer]);
                            resolve(blob);
                        } catch (err) {
                            console.error('Sharp composite error:', err);
                            reject(err);
                        }
                    });
                }).on('error', error => {
                    console.error('Error downloading the image:', error);
                    reject(error);
                });
            });

            processingPromises.push(promise);
        }

        Promise.all(processingPromises).then(async blobList => {
            if (blobList.length == 0) return;
            message.delete().catch(err => console.error('Error deleting message:', err));
            const form = new FormData();
            form.append('username', message.author.username);
            if (message.author.avatarURL() != null) {
                form.append('avatar_url', message.author.avatarURL());
            } else {
                form.append('avatar_url', message.author.defaultAvatarURL);
            }

            if (message.content.trim().length > 0) {
                form.append('content', message.content);
            }

            blobList.forEach((blob, index) => {
                form.append(`files[${index}]`, blob, `watermarked-image-${index + 1}.png`);
            });




            fetch(matchedChannel.url, {
                method: 'POST',
                body: form,
                headers: form.headers
            })
                .catch(err => console.error(err));


        }).catch(err => {
            console.error('Error processing images:', err);
        });
    }
});




client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;


    if (interaction.commandName === 'set-watermark') {
        const fileAttachment = interaction.options.getAttachment('file');
        const hasBackground = interaction.options.getBoolean('remove-background')

        interaction.deferReply()


        if (hasBackground) {

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

            // oldwatermark varsa sil
            fs.stat(oldwatermarkPath, (err, stats) => {
                if (!err && stats) {
                    fs.unlink(oldwatermarkPath, (err) => {
                        if (err) {
                            console.error(`Mevcut watermark dosyası silinirken hata oluştu: ${err}`);
                            return;
                        }
                        console.log('Mevcut oldwatermark dosyası silindi.');
                        downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, true, interaction);
                    });
                } else {
                    downloadAndSaveFile(fileAttachment.url, oldwatermarkPath, true, interaction);
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
                        console.log('Mevcut oldwatermark dosyası silindi.');
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


    if (interaction.commandName === 'add-channel') {
        try {
            const channel = interaction.options.getChannel('a-channel');
            const webhook = await channel.createWebhook({ name: 'selam' });
            const webhookUrl = webhook.url;

            const configPath = './config/config.json';

            fs.readFile(configPath, 'utf8', (err, data) => {
                if (err) {
                    console.error('An error occurred while reading the file:', err);
                    return;
                }

                const config = JSON.parse(data);
                if (!config.channels) {
                    config.channels = [];
                }
                config.channels.push({ id: channel.id, url: webhookUrl });

                channelsGlobal = config.channels;

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
                .setTimestamp();

            interaction.reply({ embeds: [embed2] });

        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    if (interaction.commandName === 'remove-channel') {
        try {
            const channel = interaction.options.getChannel('r-channel');
            const configPath = './config/config.json';

            fs.readFile(configPath, 'utf8', (err, data) => {
                if (err) {
                    console.error('An error occurred while reading the file:', err);
                    return;
                }

                const config = JSON.parse(data);
                const channelIndex = config.channels.findIndex(item => item.id === channel.id);

                if (channelIndex !== -1) {
                    config.channels.splice(channelIndex, 1);

                    channelsGlobal = config.channels;

                    fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
                        if (err) {
                            console.error('An error occurred while writing to the file:', err);
                            return;
                        }

                        // Başarıyla kaldırıldı mesajını embed ile gönder
                        const embed = new EmbedBuilder()
                            .setTitle('Channel Removal')
                            .setColor('Green')
                            .setDescription(`Channel <#${channel.id}> removed successfully.`)
                            .setTimestamp();

                        interaction.reply({ embeds: [embed] });
                    });
                } else {
                    // Kanal bulunamadı mesajını embed ile gönder
                    const embed = new EmbedBuilder()
                        .setTitle('Channel Not Found')
                        .setColor('Red')
                        .setDescription('Channel not found in the configuration.')
                        .setTimestamp();

                    interaction.reply({ embeds: [embed] });
                }

            });
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    if (interaction.commandName === 'active-channel') {
        try {
            const configPath = './config/config.json';
            const data = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(data);

            const embed = new EmbedBuilder()
                .setTitle('Active Channels')
                .setColor('Blue')
                .setTimestamp();

            for (const channelInfo of config.channels) {
                const channel = client.channels.cache.get(channelInfo.id);
                if (channel) {
                    embed.addFields({ name: channel.name, value: `ID: ${channel.id}` });
                } else {
                    embed.addFields({ name: 'Unknown Channel', value: `ID: ${channelInfo.id}` });
                }
            }

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

})







function downloadAndSaveFile(url, filePath, hasBackground, interaction) {

    try {
        const file = fs.createWriteStream(filePath);
        https.get(url, async function (response) {
            response.pipe(file);
            await new Promise((resolve, reject) => {
                file.on('finish', () => {
                    file.close();
                    console.log('Yeni watermark dosyası kaydedildi.');
                    resolve(); // Dosya tam olarak kaydedildiğinde Promise'i çöz
                });
                file.on('error', reject); // Dosya kaydedilirken bir hata oluşursa Promise'i reddet
            });

            if (hasBackground) {
                await makeWhiteTransparent(filePath);
            }

            if (filePath === oldwatermarkPath) return

            console.log('örnek resim oluşturuluyor');

            await adjustOpacityAndSave(0.2, interaction)


            // return

            // // -- değişiklik gerekirse kullanılması için duruyor --

            // const user = interaction.user;

            // const image = sharp(examplekPath);
            // const imageMetadata = await image.metadata();

            // const watermark = sharp(watermarkPath)
            //     .resize({
            //         width: imageMetadata.width,
            //         height: imageMetadata.height,
            //         fit: 'fill'
            //     })
            //     .toColourspace('rgba')

            // const outputBuffer = await image
            //     .composite([{ input: await watermark.toBuffer(), blend: 'over' }])
            //     .toBuffer();


            // fs.writeFileSync('output.png', outputBuffer);

            // const attachment = new AttachmentBuilder('output.png');
            // const embed = new EmbedBuilder()
            //     .setAuthor({ name: user.globalName, iconURL: user.avatarURL() })
            //     .setTitle('Example image:')
            //     .setDescription('To change the opacity of the watermark,\nYou can use the /set-opacity command. \n(An opacity value of 0.2 is recommended)\n(currently 1)')
            //     .setImage('attachment://output.png')
            //     .setColor('White')
            //     .setTimestamp();


            // await interaction.editReply({ embeds: [embed], files: [attachment] });


        }).on('error', (err) => {
            fs.unlink(filePath);
            console.error(`Dosya indirilirken hata oluştu: ${err}`);
        });
    } catch (error) {
        console.error('Bir hata oluştu:', error);
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

                const watermark = sharp(watermarkPath)
                    .resize({
                        width: imageMetadata.width,
                        height: imageMetadata.height,
                        fit: 'fill'
                    })
                    .toColourspace('rgba')

                const outputBuffer = await image
                    .composite([{ input: await watermark.toBuffer(), blend: 'over' }])
                    .toBuffer();


                fs.writeFileSync('output.png', outputBuffer);

                const attachment = new AttachmentBuilder('output.png');
                let embed = new EmbedBuilder()
                    .setAuthor({ name: user.globalName, iconURL: user.avatarURL() })
                    .setTitle('Example image:')
                    .setImage('attachment://output.png')
                    .setColor('White')
                    .setTimestamp();

                if (interaction.commandName === 'set-watermark') {
                    embed.setDescription('To change the opacity of the watermark,\nYou can use the /set-opacity command. \n(An opacity value of 0.2 is recommended)\n(currently 0.2)')
                }

                await sleep(1000)

                await interaction.editReply({ embeds: [embed], files: [attachment] });

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
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const threshold = 245;

        const { data, info } = await image
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true });

        for (let i = 0; i < data.length; i += info.channels) {
            if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                data[i + 3] = 0;
            }
        }

        await sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: info.channels,
            },
        }).toFile(filePath);

        console.log('İşlem tamamlandı.');
    } catch (error) {

    }

}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


client.login(token);