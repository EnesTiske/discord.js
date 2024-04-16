
//#region --- IMPORTS AND COMMANDS ---

const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { REST, Routes } = require("discord.js");
const fs = require('fs');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const prism = require('prism-media');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const execSync = require('child_process').execSync;
const exec = require('child_process').exec;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

let { clientId, guildId, token, uploadChannelId } = require('./config/config.json');
const { isTypedArray } = require('util/types');

const commands = [

    new SlashCommandBuilder()
        .setName('start-record')
        .setDescription('start-record')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('stop-record')
        .setDescription('stop-record')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('set-upload-channel')
        .setDescription('set-upload-channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('Select a channel')
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

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const directoryPath = 'recordings';

    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error('Files could not be read:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(directoryPath, file);
            fs.unlink(filePath, err => {
                if (err) {
                    console.error(`An error occurred while deleting ${file}:`, err);
                } else {
                    console.log(`${file} successfully deleted.`);
                }
            });
        });
    });
});

let uploadChannelIdG = uploadChannelId
let isRecording = false;
let outputStreams = new Map();
let connection;
let intervalControl;
let saveChannelName;

//#endregion --- IMPORTS AND COMMANDS ---


//#region --- FONCTIONS ---

async function playAudio(channel, filePath) {

    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);
    player.play(resource);
    connection.subscribe(player);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.on('voiceStateUpdate', (oldState, newState) => {

    //#region ---DISCONNECT ---

    if (oldState.member.user.id === client.user.id) {
        if (isRecording) {
            console.log('Bot left the channel, stopping recording...');
            intervalControl = true;

            if (!isRecording) return;

            let promises = []
            isRecording = false;

            outputStreams.forEach((streams, userId) => {
                streams.opusStream.unpipe();
                streams.opusDecoder.unpipe();
                streams.outputStream.end();



                let files = fs.readdirSync('recordings')
                    .filter(file => file.endsWith('.pcm'))
                    .map(file => ({
                        name: file,
                        mtime: fs.statSync(path.join('recordings', file)).mtime
                    }));

                files.forEach(fileInfo => {
                    const rawFilePath = path.join('recordings', fileInfo.name);
                    const mp3FilePath = rawFilePath.replace(/\.pcm$/, '.mp3');

                    let promise = new Promise((resolve, reject) => {
                        exec(`"${ffmpeg}" -f s16le -ar 48000 -ac 2 -i "${rawFilePath}" "${mp3FilePath}"`, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error converting to MP3: ${error}`);
                                reject(error);
                            } else {
                                console.log(`Converted ${rawFilePath} to ${mp3FilePath}`);
                                resolve(mp3FilePath);
                            }
                        });
                    });

                    promises.push(promise);
                });

                outputStreams.delete(userId);
            });

            Promise.all(promises).then(async () => {

                const recordingsPath = 'recordings';
                const date = new Date(Date.now());
                const dateString = date.toISOString().split('T')[0];
                const outputFilePath = path.join(recordingsPath, `${saveChannelName}-${dateString}.mp3`)

                const files = fs.readdirSync(recordingsPath)
                    .filter(file => file.endsWith('.mp3'))
                    .map(file => ({
                        name: file,
                        timestamp: Number(file.split('-')[0])
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);

                const minTimestamp = files[0].timestamp;
                files.forEach(file => {
                    file.delay = file.timestamp - minTimestamp;
                });

                let inputs = '', filterComplex = '';
                files.forEach((file, index) => {
                    inputs += `-i "${path.join(recordingsPath, file.name)}" `;
                    filterComplex += `[${index}:a]adelay=${file.delay}|${file.delay}[a${index}];`;
                });

                filterComplex += files.map((_, index) => `[a${index}]`).join('') + `amix=inputs=${files.length}:duration=longest:dropout_transition=2`;

                const command = `"${ffmpeg}" ${inputs} -filter_complex "${filterComplex}" "${outputFilePath}"`;
                execSync(command);



                const uploadChannel = client.channels.cache.get(uploadChannelIdG);
                if (uploadChannel) {
                    await uploadChannel.send({
                        content: `Recording stopped. Here's the audio file:`,
                        files: [outputFilePath]
                    });
                    console.log(`File uploaded: ${outputFilePath}`);
                } else {
                    console.error('Upload channel not found');
                    throw new Error('Upload channel not found');
                }

                await sleep(2000)

                const directoryPath = 'recordings';

                fs.readdir(directoryPath, (err, files) => {
                    if (err) {
                        console.error('Files could not be read:', err);
                        return;
                    }

                    files.forEach(file => {
                        const filePath = path.join(directoryPath, file);
                        fs.unlink(filePath, err => {
                            if (err) {
                                console.error(`An error occurred while deleting ${file}:`, err);
                            } else {
                                console.log(`${file} successfully deleted.`);
                            }
                        });
                    });
                });

                for (const file of files) {
                    fs.unlinkSync(path.join('recordings', file.name));
                }


            }).catch(async (error) => {
                console.error('Error processing files:', error);
                isRecording = false;
            });
        }
    }

    //#endregion --- DISCONNECT ---

    //#region --- NEW PARTICIPANT ---

    if (newState.member.user.bot) return

    if ((!oldState.channel && newState.channel) || (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id)) {

        console.log(`${newState.member.user.id} user ${newState.channel.name} `);
        console.log(isRecording)

        const isBotInChannel = newState.channel.members.has(client.user.id);

        if (isBotInChannel && isRecording) {
            try {
                const userId = newState.member.user.id;
                const opusStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: VoiceConnectionStatus.Signalling,
                        duration: 5 * 60 * 1000,
                    },
                });

                const rawFilePath = `./recordings/${Date.now()}-${userId}.pcm`;
                const outputStream = fs.createWriteStream(rawFilePath);
                const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
                opusStream.pipe(opusDecoder).pipe(outputStream);
                console.log(`Recording started: ${rawFilePath}`);
                outputStreams.set(userId, { outputStream, opusStream, opusDecoder });

            } catch (error) {
                console.error(`An error occurred during recording: ${error}`);
            }
        } else {
            console.log(`The bot is either not in the ${newState.channel.id} channel or the recording status is not active.`);
        }

    }

    //#endregion --- NEW PARTICIPANT ---

});

//#endregion --- FONCTIONS ---


//#region --- SET UPLOAD CHANNEL ---

client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'set-upload-channel') {

        const textChannels = interaction.guild.channels.cache.filter(channel => channel.type === 0);

        const choices = textChannels.map(channel => {
            return { name: channel.name, value: channel.id };
        });

        await interaction.respond(choices.slice(0, 25));
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'set-upload-channel') {
        const channelId = interaction.options.getString('channel');
        console.log(channelId);

        const configPath = 'src/config/config.json';

        fs.readFile(configPath, 'utf8', (err, data) => {
            if (err) {
                console.error('An error occurred while reading the file:', err);
                return;
            }

            const config = JSON.parse(data);
            config.uploadChannelId = channelId;
            uploadChannelIdG = channelId

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
            .setDescription(`Upload channel has been set to <#${channelId}>.`)
            .setColor('Green')
            .setTimestamp()

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

//#endregion --- SET UPLOAD CHANNEL ---


//#region --- EVENT RECORDING ---
client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
    console.log(`Event updated: ${newEvent.name}`);

    try {
        if (newEvent.status == '2') {
            console.log(`Event started: ${newEvent.name}`);

            const guild = await client.guilds.fetch(newEvent.guildId);
            const voiceChannel = await guild.channels.fetch(newEvent.channelId);

            if (!voiceChannel) {
                console.log('Voice channel not found!');
                return;
            }

            if (isRecording) {
                console.log('Already recording!');
                return;
            }

            playAudio(voiceChannel, 'src/data/startVoice.mp3')

            const directoryPath = 'recordings';
            fs.readdir(directoryPath, (err, files) => {
                if (err) {
                    console.error('Files could not be read:', err);
                    return;
                }

                files.forEach(file => {
                    const filePath = path.join(directoryPath, file);
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error(`An error occurred while deleting ${file}:`, err);
                        } else {
                            console.log(`${file} successfully deleted.`);
                        }
                    });
                });
            });

            sleep(200)

            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
            });

            saveChannelName = voiceChannel.name;

            connection.on(VoiceConnectionStatus.Ready, async () => {

                const channelMembers = voiceChannel.members;

                channelMembers.forEach(channelMember => {
                    if (channelMember.user.bot) return;


                    const userId = channelMember.user.id;
                    const opusStream = connection.receiver.subscribe(userId, {
                        end: {
                            behavior: VoiceConnectionStatus.Signalling,
                            duration: 5 * 60 * 1000,
                        },
                    });

                    let outputStream;
                    let silenceFrames = 0;
                    let emptyInterval;
                    let kontrol = false;
                    intervalControl = false;

                    opusStream.on('data', chunk => {
                        if (isSilent(chunk)) {
                            const silentBuffer = Buffer.alloc(3840);
                            if (!kontrol) {
                                kontrol = true;
                                emptyInterval = setInterval(() => {
                                    outputStream.write(silentBuffer);
                                    if (intervalControl) {
                                        clearInterval(emptyInterval);
                                    }
                                }, 40);
                            }
                            silenceFrames++;
                        } else if (!isSilent(chunk)) {
                            silenceFrames = 0;
                            clearInterval(emptyInterval);
                            kontrol = false;
                            if (!outputStream) {
                                const rawFilePath = `./recordings/${Date.now()}-${userId}.pcm`;
                                outputStream = fs.createWriteStream(rawFilePath);
                                const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
                                opusStream.pipe(opusDecoder).pipe(outputStream);
                                outputStreams.set(userId, { outputStream, opusStream, opusDecoder });
                            }
                        }
                    });
                });

                isRecording = true;
            });
        }
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }

    function isSilent(data) {
        const SILENCE_THRESHOLD = 0.01;
        for (let i = 0; i <= data.length - 2; i += 2) {
            const sample = Math.abs(data.readInt16LE(i) / 32768.0);
            if (sample > SILENCE_THRESHOLD) {
                return false;
            }
        }
        return true;
    }

    if (newEvent.status == '3') {
        console.log(`Event ended: ${newEvent.name}`);

        try {
            if (!isRecording) return;

            intervalControl = true;
            let promises = [];

            outputStreams.forEach((streams, userId) => {
                streams.opusStream.unpipe();
                streams.opusDecoder.unpipe();
                streams.outputStream.end();

                let files = fs.readdirSync('recordings')
                    .filter(file => file.endsWith('.pcm'))
                    .map(file => ({
                        name: file,
                        mtime: fs.statSync(path.join('recordings', file)).mtime
                    }));

                files.forEach(fileInfo => {
                    const rawFilePath = path.join('recordings', fileInfo.name);
                    const mp3FilePath = rawFilePath.replace(/\.pcm$/, '.mp3');

                    let promise = new Promise((resolve, reject) => {
                        exec(`"${ffmpeg}" -f s16le -ar 48000 -ac 2 -i "${rawFilePath}" "${mp3FilePath}"`, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error converting to MP3: ${error}`);
                                reject(error);
                            } else {
                                console.log(`Converted ${rawFilePath} to ${mp3FilePath}`);
                                resolve(mp3FilePath);
                            }
                        });
                    });
                    promises.push(promise);
                });

                outputStreams.delete(userId);
            });

            await Promise.all(promises).then(async () => {
                if (connection) {
                    connection.destroy();
                    connection = null;
                }

                const recordingsPath = 'recordings';
                const date = new Date(Date.now());
                const dateString = date.toISOString().split('T')[0];
                const outputFilePath = path.join(recordingsPath, `${saveChannelName}-${dateString}.mp3`)


                const files = fs.readdirSync(recordingsPath)
                    .filter(file => file.endsWith('.mp3'))
                    .map(file => ({
                        name: file,
                        timestamp: Number(file.split('-')[0])
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);

                const minTimestamp = files[0].timestamp;
                files.forEach(file => {
                    file.delay = file.timestamp - minTimestamp;
                });

                let inputs = '', filterComplex = '';
                files.forEach((file, index) => {
                    inputs += `-i "${path.join(recordingsPath, file.name)}" `;
                    filterComplex += `[${index}:a]adelay=${file.delay}|${file.delay}[a${index}];`;
                });

                filterComplex += files.map((_, index) => `[a${index}]`).join('') + `amix=inputs=${files.length}:duration=longest:dropout_transition=2`;

                const command = `"${ffmpeg}" ${inputs} -filter_complex "${filterComplex}" "${outputFilePath}"`;
                execSync(command);

                const uploadChannel = client.channels.cache.get(uploadChannelIdG);
                if (uploadChannel) {
                    await uploadChannel.send({
                        content: `Recording stopped. Here's the audio file:`,
                        files: [outputFilePath]
                    });
                    console.log(`File uploaded: ${outputFilePath}`);
                } else {
                    console.error('Upload channel not found');
                    throw new Error('Upload channel not found');
                }

                const directoryPath = 'recordings';

                await sleep(2000);

                fs.readdir(directoryPath, (err, files) => {
                    if (err) {
                        console.error('Files could not be read:', err);
                        return;
                    }

                    files.forEach(file => {
                        const filePath = path.join(directoryPath, file);
                        fs.unlink(filePath, err => {
                            if (err) {
                                console.error(`An error occurred while deleting ${file}:`, err);
                            } else {
                                console.log(`${file} successfully deleted.`);
                            }
                        });
                    });
                });

                isRecording = false;

                files.forEach(file => {
                    fs.unlinkSync(path.join('recordings', file.name));
                });

            }).catch(async (error) => {
                console.error('Error processing files:', error);
            });

        } catch (error) {
            console.error(`An unexpected error occurred: ${error}`);
        }
    }

});

//#endregion --- EVENT ---


//#region --- COMMAND RECORDING ---

client.on('interactionCreate', async interaction => {
    if (interaction.user.bot) {
        return;
    }

    const { commandName, member } = interaction;

    if (commandName === 'start-record') {
        try {
            if (isRecording) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('Already recording!')
                    .setColor('Red')
                    .setTimestamp()

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
        } catch (error) {
            console.log(error)
        }

        try {
            if (member.voice.channel) {
                const channelMembers = member.voice.channel.members;

                try {
                    connection = joinVoiceChannel({
                        channelId: member.voice.channel.id,
                        guildId: member.guild.id,
                        adapterCreator: member.guild.voiceAdapterCreator,
                        selfDeaf: false,
                        selfMute: true,
                    });

                    playAudio(member.voice.channel, 'src/data/startVoice.mp3')
                } catch (error) {
                    console.log(error)
                }

                const directoryPath = 'recordings';
                fs.readdir(directoryPath, (err, files) => {
                    if (err) {
                        console.error('Files could not be read:', err);
                        return;
                    }

                    files.forEach(file => {
                        const filePath = path.join(directoryPath, file);
                        fs.unlink(filePath, err => {
                            if (err) {
                                console.error(`An error occurred while deleting ${file}:`, err);
                            } else {
                                console.log(`${file} successfully deleted.`);
                            }
                        });
                    });
                });

                sleep(200)

                saveChannelName = member.voice.channel.name

                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('Recording started.')
                    .setColor('Green')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });


                connection.on(VoiceConnectionStatus.Ready, async () => {
                    channelMembers.forEach(channelMember => {
                        if (channelMember.user.bot) return;

                        const userId = channelMember.user.id;
                        const opusStream = connection.receiver.subscribe(userId, {
                            end: {
                                behavior: VoiceConnectionStatus.Signalling,
                                duration: 5 * 60 * 1000,
                            },
                        });

                        let outputStream;
                        let silenceFrames = 0;
                        let emptyInterval;
                        let kontrol = false;
                        intervalControl = false;

                        try {
                            opusStream.on('data', chunk => {
                                if (isSilent(chunk)) {
                                    const silentBuffer = Buffer.alloc(3840);
                                    if (!kontrol) {
                                        kontrol = true
                                        emptyInterval = setInterval(() => {

                                            outputStream.write(silentBuffer);
                                            if (intervalControl) {
                                                clearInterval(emptyInterval);
                                            }
                                        }, 40)
                                    }
                                    silenceFrames++;
                                } else if (!isSilent(chunk)) {
                                    silenceFrames = 0;
                                    clearInterval(emptyInterval);
                                    kontrol = false
                                    if (!outputStream) {
                                        const rawFilePath = `./recordings/${Date.now()}-${userId}.pcm`
                                        outputStream = fs.createWriteStream(rawFilePath);
                                        const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
                                        opusStream.pipe(opusDecoder).pipe(outputStream);
                                        outputStreams.set(userId, { outputStream, opusStream, opusDecoder });
                                    }
                                }
                            });
                        } catch (error) {
                            console.log(error)
                        }
                    });


                    isRecording = true
                    const SILENCE_THRESHOLD = 0.01;

                    function isSilent(data) {
                        for (let i = 0; i <= data.length - 2; i += 2) {
                            const sample = Math.abs(data.readInt16LE(i) / 32768.0);
                            if (sample > SILENCE_THRESHOLD) {
                                return false;
                            }
                        }
                        return true;
                    }
                })


            } else {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('You need to be in a voice channel to start recording!')
                    .setColor('Yellow')
                    .setTimestamp()

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (error) {
            console.log(error)
        }
    }



    if (commandName === 'stop-record') {
        try {

            intervalControl = true;

            if (!isRecording) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('No active recording!')
                    .setColor('Red')
                    .setTimestamp()

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await interaction.deferReply({ ephemeral: true });

            let promises = []
            isRecording = false;

            outputStreams.forEach((streams, userId) => {
                streams.opusStream.unpipe();
                streams.opusDecoder.unpipe();
                streams.outputStream.end();

                let files = fs.readdirSync('recordings')
                    .filter(file => file.endsWith( userId + '.pcm'))
                    .map(file => ({
                        name: file,
                        mtime: fs.statSync(path.join('recordings', file)).mtime
                    }));

                files.forEach(fileInfo => {
                    console.log(796)

                    const rawFilePath = path.join('recordings', fileInfo.name);
                    const mp3FilePath = rawFilePath.replace(/\.pcm$/, '.mp3');

                    const promise = new Promise((resolve, reject) => {
                        exec(`"${ffmpeg}" -f s16le -ar 48000 -ac 2 -i "${rawFilePath}" "${mp3FilePath}"`, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error converting to MP3: ${error}`);
                                reject(error);
                            } else {
                                console.log(`Converted ${rawFilePath} to ${mp3FilePath}`);
                                resolve(mp3FilePath);
                            }
                        });
                    });

                    promises.push(promise);
                });

                console.log(4)
                console.log(promises)
                outputStreams.delete(userId);
            });

            Promise.all(promises).then(async () => {
                if (connection) {
                    connection.destroy();
                    connection = null;
                }
                console.log(3)
                const recordingsPath = 'recordings';
                const date = new Date(Date.now());
                const dateString = date.toISOString().split('T')[0];
                const outputFilePath = path.join(recordingsPath, `${dateString}.mp3`)

                const files = fs.readdirSync(recordingsPath)
                    .filter(file => file.endsWith('.mp3'))
                    .map(file => ({
                        name: file,
                        timestamp: Number(file.split('-')[0])
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);

                const minTimestamp = files[0].timestamp;
                files.forEach(file => {
                    file.delay = file.timestamp - minTimestamp;
                });
                console.log(2)
                let inputs = '', filterComplex = '';
                files.forEach((file, index) => {
                    inputs += `-i "${path.join(recordingsPath, file.name)}" `;
                    filterComplex += `[${index}:a]adelay=${file.delay}|${file.delay}[a${index}];`;
                });

                filterComplex += files.map((_, index) => `[a${index}]`).join('') + `amix=inputs=${files.length}:duration=longest:dropout_transition=2`;

                const command = `"${ffmpeg}" ${inputs} -filter_complex "${filterComplex}" "${outputFilePath}"`;
                execSync(command);

                console.log(1)

                const uploadChannel = client.channels.cache.get(uploadChannelIdG);
                if (uploadChannel) {
                    await uploadChannel.send({
                        content: `Recording stopped. Here's the audio file:`,
                        files: [outputFilePath]
                    });
                    console.log(`File uploaded: ${outputFilePath}`);
                } else {
                    console.error('Upload channel not found');
                    throw new Error('Upload channel not found');
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('Recording stopped and files processed.')
                    .setColor('Green')
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed], ephemeral: true });

            }).catch(async (error) => {
                console.error('Error processing files:', error);
                const embed = new EmbedBuilder()
                    .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTitle('An error occurred during the operation.')
                    .setColor('Red')
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed], ephemeral: true });

                isRecording = false
            });
        } catch (error) {
            console.log('sss' + error)
        }
    }
});

//#endregion --- COMMAND RECORDING ---


client.login(token);