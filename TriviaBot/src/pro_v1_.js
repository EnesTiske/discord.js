//#region --IMPORTS---------------------------------------------------------------------------------------------------------------
// latest version
const { Client, GatewayIntentBits, SlashCommandBuilder, Collector, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder, calculateUserDefaultAvatarIndex, } = require('discord.js');
const { Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const { REST, Routes } = require("discord.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const he = require('he');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const fs = require('fs');
const Jimp = require('jimp');
const internal = require('stream');
const _ = require('lodash');

// const { Console } = require('console');
// const { measureMemory } = require('vm');
// const { constant } = require('lodash');

//#endregion

//#region ---GLOBAL---------------------------------------------------------------------------------------------------------------

let apiUrl = "https://opentdb.com/api.php"
let botIcon;

// let message;
let data;
let gameMode, testNumber, userId;

let userScore = 0;
let percentageScore;

//#endregion

//#region ---COMMANDS-------------------------------------------------------------------------------------------------------------

const commands = [
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Take a look at your profile!'),

    new SlashCommandBuilder()
        .setName('lobby-join')
        .setDescription('Lets you join the lobbies of your friends'),

    new SlashCommandBuilder()
        .setName('lobby-create')
        .setDescription('Lets create your lobbies for you and friends to play trivia')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Give a name to your lobby')
                .setRequired(true)
        )
        .addStringOption(option => 
            option
                .setName('type')
                .setDescription('Game type you want to play')
                .setRequired(true)
                .addChoices(
                    { name: 'First to Click', value: 'First To Click' },
                    { name: 'Most True', value: 'Most Scored' }
                )
        )
        .addIntegerOption(option => 
            option
                .setName('max-participants')
                .setDescription('Number of participants that can join')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(5)
        )
        .addBooleanOption(option =>
            option
                .setName('isprivate')
                .setDescription('True if you want to create private lobby')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('trivia-files')
        .setDescription('Questions with a specific time limit')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('timed')
        .setDescription('Questions with a specific time limit')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of questions')
                .setRequired(true)
                .setMinValue(5)
                .setMaxValue(25)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('Time limit for each question (in seconds)')
                .setRequired(true)
                .setMinValue(5)
                .setMaxValue(30)
        ),
    
    new SlashCommandBuilder()
        .setName('casual')
        .setDescription('Trivia questions')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of questions')
                .setRequired(true)
                .setMinValue(5)
                .setMaxValue(25)
        )
        .addStringOption((option) =>
            option
                .setName('difficulty')
                .setDescription('Choose the difficulty level')
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' },
                )
        )
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Question category')
                .addChoices(
                    { name: 'General Knowledge', value: '9' },
                    { name: 'Entertainment: Books', value: '10' },
                    { name: 'Entertainment: Film', value: '11' },
                    { name: 'Entertainment: Music', value: '12' },
                    { name: 'Entertainment: Musicals & Theatres', value: '13' },
                    { name: 'Entertainment: Television', value: '14' },
                    { name: 'Entertainment: Video Games', value: '15' },
                    { name: 'Entertainment: Board Games', value: '16' },
                    { name: 'Science & Nature', value: '17' },
                    { name: 'Science: Computers', value: '18' },
                    { name: 'Science: Mathematics', value: '19' },
                    { name: 'Mythology', value: '20' },
                    { name: 'Sports', value: '21' },
                    { name: 'Geography', value: '22' },
                    { name: 'History', value: '23' },
                    { name: 'Politics', value: '24' },
                    { name: 'Art', value: '25' },
                    { name: 'Celebrities', value: '26' },
                    { name: 'Animals', value: '27' },
                    { name: 'Vehicles', value: '28' },
                    { name: 'Entertainment: Comics', value: '29' },
                    { name: 'Science: Gadgets', value: '30' },
                    { name: 'Entertainment: Japanese Anime & Manga', value: '31' },
                    { name: 'Entertainment: Cartoon & Animations', value: '32' }
                )
        ).toJSON(),
].map(command => command);

const rest = new REST({ version: '10' }).setToken(token);

async function command() {
    try {
        console.log('---Started refreshing application (/) commands.---');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('---Successfully reloaded application (/) commands.---');
    } catch (error) {
        console.error(error);
    }
}

command();

//#endregion

//#region ---BOT ON---------------------------------------------------------------------------------------------------------------

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isModalSubmit()) return;   

    botIcon = client.user.displayAvatarURL();;
    userId = interaction.user.id;
    gameMode = interaction.commandName;
    userIcon = interaction.user.displayAvatarURL();
    userMention = interaction.user.globalName;

    //#region --PROFILE-----------------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'profile'){

        const userId = interaction.user.id;
        let playerProfile = profileManager.getProfile(userId);
        
        if (!playerProfile) {
            playerProfile = profileManager.createProfile(userId);
        }
        
        playerProfile = profileManager.getProfile(userId);
        let requiredXp = 10 * Math.pow(2, playerProfile.level-1);

        const user = await client.users.fetch(playerProfile.userId);

        const profileEmbed = new EmbedBuilder()
        .setAuthor({ name: user.username , iconURL: user.displayAvatarURL() })
        .setTitle(`${user.globalName}**'s profile**`)
        .setDescription(`
            **Level : ${playerProfile.level}**
            **Total xp : ${playerProfile.total_xp}** 
            **lvl up progress : ${playerProfile.xp}/${requiredXp}**
            `)
        .setColor('#ff1234')
        .setThumbnail( user.displayAvatarURL() )

        const selectMenuProfile = new StringSelectMenuBuilder()
            .setCustomId('selectMenuProfile')
            .addOptions([
                {
                    label: 'Badges',
                    value: 'badges',
                },
                {
                    label: 'Trivias',
                    value: 'trivias',
                },
            ]); 

        const profileRow = new ActionRowBuilder().addComponents(selectMenuProfile);

        let message = await interaction.reply({ embeds: [profileEmbed], components: [profileRow], ephemeral: true });

        const collector = message.createMessageComponentCollector({});

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'selectMenuProfile') {
                if (interaction.values[0] === 'badges') {

                    const badgeFolder = './badges/';
                    const images = [];
                    const spacing = 20;
                    const spacingColor = 0x404040FF; 
                    let lockedBadges = 0
                
                    // Resimleri badges klasöründen yükleme
                    for (let i = 9; i <= 32; i++) {
                      const imageUrl = `${badgeFolder}${i}.png`;
                
                      try {
                        let image = await Jimp.read(imageUrl);

                        if(playerProfile.badges[i-9] < 25){
                            image = image.greyscale()
                            lockedBadges++
                        }
                        
                        if(playerProfile.badges[i-9] > 25*4) {
                            Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
                            .then(font => {
                              image.print(
                                font,
                                image.bitmap.width - 60,
                                image.bitmap.height - 60,
                                'IV'
                              );
                            })
                            .catch(err => console.error(err));
                            }else if(playerProfile.badges[i-9] > 25*3) {
                            Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
                            .then(font => {
                              image.print(
                                font,
                                image.bitmap.width - 60,
                                image.bitmap.height - 60,
                                'III'
                              );
                            })
                            .catch(err => console.error(err));
                        }else if(playerProfile.badges[i-9] > 25*2) {
                            Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
                            .then(font => {
                              image.print(
                                font,
                                image.bitmap.width - 45,
                                image.bitmap.height - 60,
                                'II'
                              );
                            })
                            .catch(err => console.error(err));
                        } else if(playerProfile.badges[i-9] > 25*1) {
                            Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
                            .then(font => {
                              image.print(
                                font,
                                image.bitmap.width - 25,
                                image.bitmap.height - 60,
                                'I'
                              );
                            })
                            .catch(err => console.error(err));
                        }

                        images.push(image);
                      } catch (error) {
                        console.error(`Error loading image ${imageUrl}: ${error.message}`);
                      }
                    }

                    const combinedImageWidth = images[0].bitmap.width * 6 + spacing * 5;
                    const combinedImageHeight = images[0].bitmap.height * 4 + spacing * 3;
                    const combinedImage = new Jimp(combinedImageWidth, combinedImageHeight, spacingColor);                    
                    
                    let x = 0;
                    let y = 0;

                    for (const image of images) {
                        combinedImage.blit(image, x, y);
                        x += image.bitmap.width + spacing;

                    if (x >= combinedImageWidth) {
                        x = 0;
                        y += image.bitmap.height + spacing;
                    }
                    }

                    // Birleştirilmiş resmi diske kaydet
                    const outputFileName = 'mergedImage.jpg';
                    await combinedImage.writeAsync(outputFileName);

                    const attachment = new AttachmentBuilder(outputFileName);

                    const embed = new EmbedBuilder()
                        .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                        .setTitle(`**All the badges of ${user.globalName}**`)
                        .setDescription(`You have successfully unlocked ${24-lockedBadges}/24`)
                        .setColor('#00ffff')
                        .setImage(`attachment://${outputFileName}`);


                    interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });

                    

                } 
                if (interaction.values[0] === 'trivias') {
                    message.delete();                    
                    trivias(interaction);
                    
                    const fileContent = fs.readFileSync('trivia_save_files.json', 'utf-8');
                    let jsonData = JSON.parse(fileContent);

                    const collector = message.createMessageComponentCollector({});
                
                    collector.on('collect', async (interaction) => {
                        if (interaction.customId === 'triviaFileSelect') {
                
                            let selectedTestNumber = interaction.values[0];
                            
                            await interaction.reply({
                                content: `Seeing you again is nice!`,
                                components: [],
                                ephemeral: true
                            });
                
                            let targetTest = jsonData.tests.find(test => test.testNumber === selectedTestNumber);
                
                            console.log(targetTest)
                
                            let targetQuestions = targetTest.questions
                
                            triviaApi.datas = targetQuestions;
                            message.delete();
                            await triviaApi.printQuestions(interaction, 0);
                
                        }
                    });    
                }
        }
    });



    } 

    //#endregion

    //#region --JOIN--------------------------------------------------------------------------------------------------------------

    //#region ----LOBBY SELECT----------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'lobby-join') {

        let inLobby = false;
        lobbies.forEach(search => {
            search.participants.forEach(players => {
                if(players === interaction.user.id) {
                    interaction.reply({ content: 'You can\'t join another lobby while in a lobby.',  ephemeral: true })
                    inLobby = true
                }
            }); 
        });
        if (inLobby) {
            return;
        }  

        const publicLobbies = lobbies.filter(lobby => !lobby.isPrivate);

        if (publicLobbies.length === 0) {
            await interaction.reply({content: "There are no public lobbies available.",  ephemeral: true});
            return;
        }

        const lobbyOptions = publicLobbies.map(lobby => ({
            label: lobby.name,
            value: lobby.lobbyId,
        }));


        const lobbyListEmbed = new EmbedBuilder()
            .setTitle('Public Lobbies')
            .setDescription(publicLobbies.map(lobby => `**${lobby.name}** - ${lobby.participants.length}/${lobby.maxParticipants} participants`).join('\n'))
            .setColor('#00FF00');

        const lobbySelectMenu = new StringSelectMenuBuilder()
            .setCustomId('joinLobbySelect')
            .setPlaceholder('Select a public lobby to join')
            .addOptions(lobbyOptions);

            const row7 = new ActionRowBuilder()
            .addComponents(lobbySelectMenu);

        let message = await interaction.reply({
            embeds: [lobbyListEmbed],
            content: 'Choose a public lobby to join:',
            components: [row7],
            ephemeral: true
        });

        const collector = message.createMessageComponentCollector({});

        //#endregion

    //#region ----FIRST------------------------------------------------------------------------------------------------------------
        collector.on('collect', async (selectInteraction) => {
            if (selectInteraction.customId === 'joinLobbySelect') {
                const selectedLobbyName = selectInteraction.values[0];
                const selectedLobby = lobbies.find(lobby => lobby.lobbyId === selectedLobbyName);

                if (!selectedLobby) {
                    await selectInteraction.reply({content: "The selected lobby does not exist.",  ephemeral: true});
                    return;
                }
        
                if (selectedLobby.participants.length >= selectedLobby.maxParticipants) {
                    await selectInteraction.reply({components: "The selected lobby is full.",  ephemeral: true});
                    return;
                }

                selectedLobby.addParticipant(selectInteraction.user.id);
                selectInteraction.deferUpdate()
        
                const owner = await client.users.fetch(selectedLobby.ownerId);
                
                const playerList = selectedLobby.participants.map(playerId => {
                    const player = client.users.fetch(playerId);
                    const isHost = playerId === selectedLobby.hostId;
                    const hostEmoji = isHost ? '<:crown:123456789012345678>' : '';
                    return `${hostEmoji} ${player ? `<@${playerId}>` : "Unknown Player"}`;
                }).join('\n');  
        
                const lobbyEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Owner: @${owner.globalName} `, iconURL: owner.displayAvatarURL() })
                    .setTitle(selectedLobby.name)
                    .setDescription(`**Game Mode:**  ${selectedLobby.gameType}\n **Question Count: **${selectedLobby.lobbyAmount} \n **Lobby Type:** ${selectedLobby.isPrivate ? 'Private' : 'Public'} \n\n **Players:**\n${playerList}`)
                    .setFooter({ text: `Player Count: ${selectedLobby.participants.length}/${selectedLobby.maxParticipants}` })
                    .setColor('#FF4656');
        
                   let rowLobby3 = new ActionRowBuilder();

                    if (interaction.user.id === selectedLobby.hostId) {
                        const startButton = new ButtonBuilder()
                            .setCustomId('startButton')
                            .setLabel('Start')
                            .setStyle(ButtonStyle.Primary);
                    
                        rowLobby3.addComponents(startButton);
                    } else {
                        const readyButton = new ButtonBuilder()
                            .setCustomId('readyButton')
                            .setLabel('Ready')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(selectedLobby.readyPlayers.includes(interaction.user.id));

                        rowLobby3.addComponents(readyButton);
                    }
                    
                    const leaveButton = new ButtonBuilder()
                        .setCustomId('leaveButton')
                        .setLabel('Leave')
                        .setStyle(ButtonStyle.Danger);
                    
                    rowLobby3.addComponents(leaveButton);
                    
                const selectMenu1 = new StringSelectMenuBuilder()
                    .setDisabled(interaction.user.id !== selectedLobby.hostId) 
                    .setCustomId('lobbyChoice')
                    .setPlaceholder('Choose setting you want to configure')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setEmoji('⚔️')
                            .setLabel(`Game Mode: ${selectedLobby.secondaryGameType}`)
                            .setValue('changeGameMode'),
                        new StringSelectMenuOptionBuilder()
                            .setEmoji('🌐')
                            .setLabel(`Lobby Type: ${selectedLobby.secondaryLobbyType ? 'Private' : 'Public'}`)
                            .setValue('changeLobbyMode'),
                        new StringSelectMenuOptionBuilder()
                            .setEmoji('📝')
                            .setLabel('Question Amount')
                            .setValue('questionAmount'),
                        new StringSelectMenuOptionBuilder()
                            .setEmoji("⏲️")
                            .setLabel('Question Duration')
                            .setValue('questionDuration'),
                    );
        
                const participants = selectedLobby.participants
                .map(playerId => ({
                    label: interaction.guild.members.cache.get(playerId)?.displayName || "Unknown Player",
                    value: playerId,
                }));
        
                const selectHost = new StringSelectMenuBuilder()
                    .setDisabled(interaction.user.id !== selectedLobby.hostId) 
                    .setCustomId('hostChoice')
                    .setPlaceholder('Choose the player to transfer the host role')
                    .addOptions(...participants);

                const selectKick = new StringSelectMenuBuilder()
                    .setDisabled(interaction.user.id !== selectedLobby.hostId) 
                    .setCustomId('kickChoice')
                    .setPlaceholder('Select the user you want to kick.')
                    .addOptions(...participants);
        
               let rowLobby1 = new ActionRowBuilder().addComponents(selectMenu1);
               let rowLobby2 = new ActionRowBuilder().addComponents(selectHost);
               let rowLobby4 = new ActionRowBuilder().addComponents(selectKick);
                
                if(!interaction.replied && interaction.replied !== undefined)
                message = await interaction.reply({ embeds: [lobbyEmbed], components: [rowLobby1, rowLobby2, rowLobby4, rowLobby3],  ephemeral: true });
        
                selectedLobby.printLobby(interaction);

                //#endregion

               const collector = message.createMessageComponentCollector({});

               collector.on('collect', async (interactionLobby) => {
                if (interactionLobby.customId === 'leaveButton') {
                
                    const leftLobby = selectedLobby.participants.includes(interactionLobby.user.id);
                    if (leftLobby) {
                        interaction.deleteReply()
                        selectedLobby.removeParticipant(interactionLobby.user.id);
                    }
                    let leaveEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                    .setTitle(`
                    You have left the lobby !
                    `)
                    .setImage('https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif')
                    .setColor('#bf0000')
                    .setTimestamp()

                    await interactionLobby.reply({ embeds: [leaveEmbed], ephemeral: true });
                }

                if (interactionLobby.customId === 'hostChoice') {
                    selectedLobby.hostId = interactionLobby.values[0];
                    selectedLobby.isChanged = true
                    interactionLobby.deferUpdate();
                }

                if (interactionLobby.customId === 'kickChoice') {

                    selectedLobby.removeParticipant(interactionLobby.values[0])
                    selectedLobby.isChanged = true
                    selectedLobby.kickPlayer.push(interactionLobby.values[0])
                    interactionLobby.deferUpdate();
                }

                if (interactionLobby.customId === 'lobbyChoice') {
                    let selectedOperation = interactionLobby.values[0];

                    switch (selectedOperation) {
                        case 'changeGameMode':
                            let temp = selectedLobby.gameType;
                            selectedLobby.gameType = selectedLobby.secondaryGameType;
                            selectedLobby.secondaryGameType = temp;
                            selectedLobby.isChanged = true
                            interactionLobby.deferUpdate()
                            break;
                        case 'changeLobbyMode':
                            selectedLobby.isPrivate = !selectedLobby.isPrivate;
                            selectedLobby.secondaryLobbyType = !selectedLobby.secondaryLobbyType;
                            selectedLobby.isChanged = true
                            interactionLobby.deferUpdate()
                            break;
                        case 'questionAmount':
                            const modalAmount = new ModalBuilder()
                                .setCustomId('lobbyAmountModal')
                                .setTitle('Enter question count'); 
                            
                            const lobbyAmountInput = new TextInputBuilder()
                                .setCustomId('lobbyAmountInput')
                                .setLabel("ONLY INTEGER BETWEEN 5 AND 25")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                            
                            const firstActionRow = new ActionRowBuilder().addComponents(lobbyAmountInput);
                            
                            modalAmount.addComponents(firstActionRow)
                            interactionLobby.showModal(modalAmount);
                            break;
                        case 'questionDuration':
                            const modalDuration = new ModalBuilder()
                                .setCustomId('lobbyDurationModal')
                                .setTitle('Enter question duration'); 
                            
                            const lobbyDurationInput = new TextInputBuilder()
                                .setCustomId('lobbyDurationInput')
                                .setLabel("ONLY INTEGER BETWEEN 5 AND 25")
                                .setStyle(TextInputStyle.Short);
                            
                            const secondActionRow = new ActionRowBuilder().addComponents(lobbyDurationInput);
                            
                            modalDuration.addComponents(secondActionRow)
                            interactionLobby.showModal(modalDuration);
                            break;
                    }
                }

                if (interactionLobby.customId === 'startButton') {
                    if (selectedLobby.readyPlayers.length >= selectedLobby.participants.length - 1) {
                        message.delete()

                        await realLobby.getLobbyQuestions(realLobby.lobbyAmount)

                        realLobby.gameStart = true;
                        realLobby.isChanged = true;
                    }else {
                        const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                        .setTitle('**Not all players are ready!**')
                        .setImage('https://media.giphy.com/media/tXL4FHPSnVJ0A/giphy.gif')
                        .setColor('cccccc')
                        const errorMessage = await interactionLobby.reply({ embeds: [errorEmbed], ephemeral: true })
        
                        setTimeout(async () => {
                            await errorMessage.delete();
                        }, 3500);
                    }
                }
                if (interactionLobby.customId === 'readyButton') {
                    selectedLobby.readyPlayers.push(interactionLobby.user.id);
                    interactionLobby.deferUpdate();
                    selectedLobby.isChanged = true
                }
            })
            }
        });
    }

    //#endregion

    //#region --CREATE-------------------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'lobby-create') {

        //#region ----FIRST---------------------------------------------------------------------------------------------------------

        let inLobby = false;
        lobbies.forEach(search => {
            search.participants.forEach(players => {
                if(players === interaction.user.id) {
                    interaction.reply({ content: 'You cant create a lobby while in a lobby',  ephemeral: true })
                    inLobby = true
                }
            }); 
        });
        if (inLobby) {
            return;
        } 
        else {       
            const newLobby = new Lobby(interaction);
            lobbies.push(newLobby);

            newLobby.lobbyId = generateSeed()

            realLobby = lobbies.find(realLobby => realLobby.lobbyId === newLobby.lobbyId)

            const owner = await client.users.fetch(realLobby.ownerId);
            
            const playerList = realLobby.participants.map(playerId => {
                const player = client.users.fetch(playerId);
                const isHost = playerId === realLobby.hostId;
                const hostEmoji = isHost ? '<:crown:123456789012345678>' : '';
                return `${hostEmoji} ${player ? `<@${playerId}>` : "Unknown Player"}`;
            }).join('\n');  

            const lobbyEmbed = new EmbedBuilder()
                .setAuthor({ name: `Owner: @${owner.globalName} `, iconURL: owner.displayAvatarURL() })
                .setTitle(realLobby.name)
                .setDescription(`**Game Mode:**  ${realLobby.gameType}\n **Question Count: **${realLobby.lobbyAmount} \n **Lobby Type:** ${realLobby.isPrivate ? 'Private' : 'Public'} \n\n **Players:**\n${playerList}`)
                .setFooter({ text: `Player Count: ${realLobby.participants.length}/${realLobby.maxParticipants}` })
                .setColor('#FF4656');

               let rowLobby3 = new ActionRowBuilder();

                if (interaction.user.id === realLobby.hostId) {
                    const startButton = new ButtonBuilder()
                        .setCustomId('startButton')
                        .setLabel('Start')
                        .setStyle(ButtonStyle.Primary);
                
                    rowLobby3.addComponents(startButton);
                } else {
                    const readyButton = new ButtonBuilder()
                        .setCustomId('readyButton')
                        .setLabel('Ready')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(realLobby.readyPlayers.includes(interaction.user.id));
                
                    rowLobby3.addComponents(readyButton);
                }
                
                const leaveButton = new ButtonBuilder()
                    .setCustomId('leaveButton')
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Danger);
                
                rowLobby3.addComponents(leaveButton);
                
            const selectMenu1 = new StringSelectMenuBuilder()
                .setDisabled(interaction.user.id !== realLobby.hostId) 
                .setCustomId('lobbyChoice')
                .setPlaceholder('Choose setting you want to configure')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setEmoji('⚔️')
                        .setLabel(`Game Mode: ${realLobby.secondaryGameType}`)
                        .setValue('changeGameMode'),
                    new StringSelectMenuOptionBuilder()
                        .setEmoji('🌐')
                        .setLabel(`Lobby Type: ${realLobby.secondaryLobbyType ? 'Private' : 'Public'}`)
                        .setValue('changeLobbyMode'),
                    new StringSelectMenuOptionBuilder()
                        .setEmoji('📝')
                        .setLabel('Question Amount')
                        .setValue('questionAmount'),
                    new StringSelectMenuOptionBuilder()
                        .setEmoji("⏲️")
                        .setLabel('Question Duration')
                        .setValue('questionDuration'),
                );

            const participants = newLobby.participants
            .map(playerId => ({
                label: interaction.guild.members.cache.get(playerId)?.displayName || "Unknown Player",
                value: playerId,
            }));

            const selectHost = new StringSelectMenuBuilder()
                .setDisabled(interaction.user.id !== realLobby.hostId) 
                .setCustomId('hostChoice')
                .setPlaceholder('Choose the player to transfer the host role')
                .addOptions(...participants);

            const selectKick = new StringSelectMenuBuilder()
                .setDisabled(interaction.user.id !== realLobby.hostId) 
                .setCustomId('kickChoice')
                .setPlaceholder('Select the user you want to kick.')
                .addOptions(...participants);

           let rowLobby1 = new ActionRowBuilder().addComponents(selectMenu1);
           let rowLobby2 = new ActionRowBuilder().addComponents(selectHost);
           let rowLobby4 = new ActionRowBuilder().addComponents(selectKick);
            
            if(!interaction.replied && interaction.replied !== undefined)
            message = await interaction.reply({ embeds: [lobbyEmbed], components: [rowLobby1, rowLobby2, rowLobby4, rowLobby3],  ephemeral: true });

            realLobby.printLobby(interaction, realLobby.lobbyId);
            
            //#endregion

            const collector = message.createMessageComponentCollector({});

            collector.on('collect', async (interactionLobby) => {   
                for (const lobby of lobbies) {
                    for (const player of lobby.participants) {
                        if (player === interactionLobby.user.id) {
                            realLobby = lobby;
                        }
                    }
                }

                if (interactionLobby.customId === 'leaveButton') {
                
                    const leftLobby = realLobby.participants.includes(interactionLobby.user.id);
                    if (leftLobby) {
                        interaction.deleteReply()
                        realLobby.removeParticipant(interactionLobby.user.id);
                    }
                    let leaveEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                    .setTitle(`
                    You have left the lobby !
                    `)
                    .setImage('https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif')
                    .setColor('#bf0000')
                    .setTimestamp()

                    await interactionLobby.reply({ embeds: [leaveEmbed], ephemeral: true });
                }

                if (interactionLobby.customId === 'hostChoice') {
                    realLobby.hostId = interactionLobby.values[0];
                    realLobby.isChanged = true
                    interactionLobby.deferUpdate();
                }

                if (interactionLobby.customId === 'kickChoice') {

                    realLobby.removeParticipant(interactionLobby.values[0])
                    realLobby.isChanged = true
                    realLobby.kickPlayer.push(interactionLobby.values[0])
                    interactionLobby.deferUpdate()
                }

                if (interactionLobby.customId === 'lobbyChoice') {
                    let selectedOperation = interactionLobby.values[0];

                    switch (selectedOperation) {
                        case 'changeGameMode':
                            let temp = realLobby.gameType;
                            realLobby.gameType = realLobby.secondaryGameType;
                            realLobby.secondaryGameType = temp;
                            realLobby.isChanged = true
                            interactionLobby.deferUpdate()
                            break;
                        case 'changeLobbyMode':
                            realLobby.isPrivate = !realLobby.isPrivate;
                            realLobby.secondaryLobbyType = !realLobby.secondaryLobbyType;
                            realLobby.isChanged = true
                            interactionLobby.deferUpdate()
                            break;
                        case 'questionAmount':
                            const modalAmount = new ModalBuilder()
                                .setCustomId('lobbyAmountModal')
                                .setTitle('Enter question count'); 
                            
                            const lobbyAmountInput = new TextInputBuilder()
                                .setCustomId('lobbyAmountInput')
                                .setLabel("ONLY INTEGER BETWEEN 5 AND 25")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                            
                            const firstActionRow = new ActionRowBuilder().addComponents(lobbyAmountInput);
                            
                            modalAmount.addComponents(firstActionRow)
                            interactionLobby.showModal(modalAmount);
                            break;
                        case 'questionDuration':
                            const modalDuration = new ModalBuilder()
                                .setCustomId('lobbyDurationModal')
                                .setTitle('Enter question duration'); 
                            
                            const lobbyDurationInput = new TextInputBuilder()
                                .setCustomId('lobbyDurationInput')
                                .setLabel("ONLY INTEGER BETWEEN 5 AND 25")
                                .setStyle(TextInputStyle.Short);
                            
                            const secondActionRow = new ActionRowBuilder().addComponents(lobbyDurationInput);
                            
                            modalDuration.addComponents(secondActionRow)
                            interactionLobby.showModal(modalDuration);
                            break;
                    }
                }

                if (interactionLobby.customId === 'startButton') {
                    if (realLobby.readyPlayers.length >= realLobby.participants.length - 1) {

                        interactionLobby.deferUpdate()
                        await realLobby.getLobbyQuestions(realLobby.lobbyAmount)
                        realLobby.gameStart = true;
                        realLobby.isChanged = true;
                    } 
                    else {
                        const errorEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                        .setTitle('**Not all players are ready!**')
                        .setImage('https://media.giphy.com/media/tXL4FHPSnVJ0A/giphy.gif')
                        .setColor('cccccc')
                        const errorMessage = await interactionLobby.reply({ embeds: [errorEmbed], ephemeral: true })
        
                        setTimeout(async () => {
                            await errorMessage.delete();
                        }, 3500);
                    }
                }

                if (interactionLobby.customId === 'readyButton') {
                    realLobby.readyPlayers.push(interactionLobby.user.id);
                    interactionLobby.deferUpdate();
                    realLobby.isChanged = true
                }

            })
        }
    }
    //#region ----LOBBY MODAL-----------------------------------------------------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === 'lobbyAmountModal') {

        const targetLobby = lobbies.find(targetLobby => targetLobby.hostId === interaction.user.id)
        let amountInput = interaction.fields.getTextInputValue('lobbyAmountInput');
        amountInput = parseInt(amountInput)

        if (!isNaN(amountInput) && typeof amountInput === 'number') {
            if (5 <= amountInput && amountInput <= 25 ) {
                interaction.deferUpdate();
                targetLobby.lobbyAmount = amountInput;
                targetLobby.isChanged = true;
            } else {
                const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                .setTitle('**Please enter a number between 5 and 25!**')
                .setImage('https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif')
                .setColor('cccccc')
                const errorMessage = await interaction.reply({ embeds: [errorEmbed], ephemeral: true })

            setTimeout(async () => {
                await errorMessage.delete();
            }, 4200);
            targetLobby.isChanged = true
            }
        } else {
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                .setTitle('**Please do not use characters other than numbers!**')
                .setImage('https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif')
                .setColor('cccccc')
                const errorMessage = await interaction.reply({ embeds: [errorEmbed], ephemeral: true })

            setTimeout(async () => {
                await errorMessage.delete();
            }, 4200);
            targetLobby.isChanged = true
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'lobbyDurationModal') {

        const targetLobby = lobbies.find(targetLobby => targetLobby.hostId === interaction.user.id)
        let durationInput = interaction.fields.getTextInputValue('lobbyDurationInput');
        durationInput = parseInt(durationInput)

        if (!isNaN(durationInput) && typeof durationInput === 'number') {
            if (5 <= durationInput && durationInput <= 25 ) {
                interaction.deferUpdate();
                targetLobby.lobbyDuration = durationInput;
                targetLobby.isChanged = true;
            } else {
                const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                .setTitle('**Please enter a number between 5 and 25!**')
                .setImage('https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif')
                .setColor('cccccc')
                const errorMessage = await interaction.reply({ embeds: [errorEmbed], ephemeral: true })

            setTimeout(async () => {
                await errorMessage.delete();
            }, 4200);
            targetLobby.isChanged = true
            }
        } else {
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                .setTitle('**Please do not use characters other than numbers!**')
                .setImage('https://media.giphy.com/media/hyyV7pnbE0FqLNBAzs/giphy.gif')
                .setColor('cccccc')
                const errorMessage = await interaction.reply({ embeds: [errorEmbed], ephemeral: true })

            setTimeout(async () => {
                await errorMessage.delete();
            }, 4200);
            targetLobby.isChanged = true
        }
    }
    
    //#endregion

    //#endregion

    //#region --TRIVIAFILES COMMAND------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'trivia-files') {
        trivias(interaction);
    }
    
    //#endregion
    
    //#region --TIMED MOD---------------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'timed') {
        interaction.deferReply({ephemeral: true})
        const duration = interaction.options.getInteger('duration');
        const amount = interaction.options.getInteger('amount');
        const difficulty = interaction.options.getString('difficulty');
        const category = interaction.options.getString('category');

        await triviaApi.fetchQuestions(amount, difficulty, category);

        await triviaApi.printQuestions(interaction, 0, gameMode, testNumber);

    } 
    //#endregion

    //#region --CASUAL MOD--------------------------------------------------------------------------------------------------------

    if (interaction.commandName === 'casual') {
        interaction.deferReply({ephemeral: true})
        const amount = interaction.options.getInteger('amount');
        const difficulty = interaction.options.getString('difficulty');
        const category = interaction.options.getString('category');

        await triviaApi.fetchQuestions(amount, difficulty, category);
        await triviaApi.printQuestions(interaction, 0, gameMode, testNumber);
    }
    //#endregion
})

//#endregion

//#region ---FUNCTIONS------------------------------------------------------------------------------------------------------------

async function trivias(interaction) {
    const fileContent = fs.readFileSync('trivia_save_files.json', 'utf-8');
    let jsonData = JSON.parse(fileContent);

    jsonData.tests = jsonData.tests.filter(test => test.gameMode === 'casual' && test.userId === userId);

    const triviaFileOptions = jsonData.tests.slice(-24).map((file, index) => ({
        label: `Test Numbers:  ${file.testNumber}`,
        value: `${file.testNumber}`,
    }));

    const selectMenu1 = new StringSelectMenuBuilder()
        .setCustomId('triviaFileSelect')
        .setPlaceholder('Select a test number')
        .addOptions(triviaFileOptions); 

    let row5 = new ActionRowBuilder().addComponents(selectMenu1);

    let message = await interaction.reply({ components: [row5],  ephemeral: true });

    const collector = message.createMessageComponentCollector({});

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'triviaFileSelect') {
            let selectedTestNumber = interaction.values[0];

            await interaction.reply({
                content: `Seeing you again is nice!`,
                components: [],
                ephemeral: true
            });

            let targetTest = jsonData.tests.find(test => test.testNumber === selectedTestNumber);

            let targetQuestions = targetTest.questions

            triviaApi.datas = targetQuestions;
            message.delete();
            await triviaApi.printQuestions(interaction, 0);

        }
    });    
}
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function saveAnswerToJson(userId, gameMode) {
    const fileName = 'trivia_save_files.json';
    const testNumber = generateSeed();

    try {
        let triviaData = { tests: [] };

        if (fs.existsSync(fileName)) {
            const fileContent = fs.readFileSync(fileName, 'utf-8');
            triviaData = JSON.parse(fileContent);
        }

        const existingTest = triviaData.tests.find( test => test.userId === userId && test.gameMode === gameMode && test.testNumber === testNumber );
        if (existingTest) {
            existingTest.questions = [triviaApi.datas];
        } else {
            const newTest = {
                userId: userId,
                gameMode: gameMode,
                testNumber: testNumber,
                questions: triviaApi.datas
            };
            triviaData.tests.push(newTest);
        }
        
        fs.writeFileSync(fileName, JSON.stringify(triviaData, null, 2));
    } catch (error) {
        console.error('Error writing JSON file:', error);
    }
}
function generateSeed() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 16; // Seed uzunluğu

    let seed = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        seed += characters.charAt(randomIndex);
    }

    return seed;
}

//#endregion

//#region ---CLASSES---------------------------------------------------------------------------------------------------------------

//#region ---CLASS LOBBY---------------------------------------------------------------------------------------------------------

class Lobby {
    constructor(interaction) {
        this.lobbyId;
        this.name = interaction.options.getString('name').toUpperCase();
        this.gameType = interaction.options.getString('type');
        this.maxParticipants = interaction.options.getInteger('max-participants');
        this.isPrivate = interaction.options.getBoolean('isprivate');
        this.ownerId =  interaction.user.id;
        this.hostId = interaction.user.id;

        this.lobbyAmount = 5;
        this.lobbyDuration = 10;

        this.gameStart = false;
        this.questionIndex = 0;
        this.answerButtons = [];
        this.newAnswerButtons = [];
        this.correct_answer;
        this.answeredPlayers = []

        this.playerScores = [{id: this.ownerId, score: 0}]
        this.participants = [this.ownerId]; 
        this.kickPlayer = []
        this.readyPlayers = [];
        this.isChanged = false;
        this.updates = 0;
        this.updatesQuestion = 0;
        
        this.lobbyDatas = [];

        this.secondaryGameType = this.calculateSecondaryGameType();
        this.secondaryLobbyType = this.calculateSecondaryLobbyType();
    }

    calculateSecondaryGameType() {
        if (this.gameType === 'First To Click') return 'Most Scored';
        if (this.gameType === 'Most Scored') return 'First To Click';
        return;
    }

    calculateSecondaryLobbyType() {
        return !this.isPrivate;
    }

    addParticipant(userId) {
        this.participants.push(userId);
        this.playerScores.push({ id: userId, score: 0 });
        this.isChanged = true;


    }

    removeParticipant(userId) {
        const index = this.participants.indexOf(userId);
        if (index !== -1) {
            const scoreIndex = this.playerScores.findIndex(playerScore => playerScore.id === userId);
            this.participants.splice(index, 1);
            if (userId === this.hostId) {
                const newHostId = this.participants.find(participant => participant !== userId);
                this.hostId = newHostId;
            }
            if (scoreIndex !== -1) {
                this.playerScores.splice(scoreIndex, 1);
            }
            if (this.participants.length === 0) {
                const lobbyIndex = lobbies.indexOf(this);
                if (lobbyIndex !== -1) {
                    lobbies.splice(lobbyIndex, 1);
                }
            }
    
        }
        this.isChanged = true
    }

    async getLobbyQuestions(amount){
        let apiUrlWithParams
        apiUrlWithParams = `${apiUrl}?amount=${amount}`;

        const response = await fetch(apiUrlWithParams);
        const data = await response.json();

            this.lobbyDatas = data.results.map(question => {
                question.isAnswered = false; 
                question.isCorrect = ""; 
                question.userAnswer = "";

                const correctAnswerIndex = Math.floor(Math.random() * (question.incorrect_answers.length + 1));
                const answers = [...question.incorrect_answers];
                answers.splice(correctAnswerIndex, 0, question.correct_answer);
    
                question.answers = answers;

                question.question = he.decode(question.question);
                question.correct_answer = he.decode(question.correct_answer);
                question.incorrect_answers = question.incorrect_answers.map(answer => he.decode(answer));
                question.category = he.decode(question.category);

                return question
            })
    }

    async printMostScored(interactions){

    }

    async printFirstToClick(interaction){

        let newLobby;
        for (const lobby of lobbies) {
            for (const player of lobby.participants) {
                if (player === interaction.user.id) {
                    newLobby = lobby;
                }
            }
        }
                            
        //#region ----EDIT REPLY-------------------------------------------------------------------------------------------------------------
        let questionIntervel = setInterval(() => {

            newLobby.questionIndex++
            newLobby.questionIndex -= newLobby.updatesQuestion 

            newLobby.answeredPlayers = []
            
            if (newLobby.questionIndex >= newLobby.lobbyDatas.length) {
                console.log("*  *   *   *   *   *   *   *   *   *   *")
                clearInterval(questionIntervel);

                newLobby.playerScores.sort((a, b) => b.score - a.score);

                let scoreEmbed = new EmbedBuilder()
                .setAuthor({ name: `Trivia Bot`, iconURL: botIcon })
                .setTitle('**- --- -----=======  Player Scores  =======----- --- -**')
                .setTimestamp()
                .setColor('#e2e200')
                .setImage('https://media.giphy.com/media/3oz9ZE2Oo9zRC/giphy.gif')

                for (let i = 0; i < newLobby.playerScores.length; i++) {
                    let user = client.users.cache.get(newLobby.playerScores[i].id);

                    scoreEmbed.addFields({
                        name: `#${i + 1} ${user.globalName}`,
                        value: `Score : ${newLobby.playerScores[i].score}`
                    });
                    scoreEmbed.addFields(
                        {name: '\n', value: '\n'},
                        {name: '\n', value: '\n'}
                    )
                }

                let socareMessage = interaction.editReply({content: '', embeds: [scoreEmbed],components: [], ephemeral: true})

            }
            else {

                    let lobbyData = newLobby.lobbyDatas[newLobby.questionIndex]

                    newLobby.correct_answer = lobbyData.correct_answer
                            
                    let questionEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Trivia Bot     Time Remaining: ${Math.max(newLobby.lobbyDuration, 0)} second`, iconURL: botIcon})
                        .setTitle(`**${lobbyData.question}**`)
                        .addFields(
                            {name: '\n', value: '\n'},
                            {name: '\n', value: '\n'}
                        )
                        .setFooter({text: 'Difficulty Level ' + lobbyData.difficulty + '   |   Category ' + lobbyData.category})
                        .setColor('#0000FF');


                        newLobby.answerButtons = lobbyData.answers.map((answer, currentQuestionIndex) => {
                        const option = String.fromCharCode('A'.charCodeAt(0) + currentQuestionIndex);
                
                        return new ButtonBuilder()
                            .setCustomId(`answer_${option}`)
                            .setLabel(`${answer}`)
                            .setStyle(ButtonStyle.Secondary)
                    });

                    
                    let sayac = newLobby.lobbyDuration
                    let sayacIntervel = setInterval(() => {
                                                
                        sayac--

                        if (sayac == 0) {
                            clearInterval(sayacIntervel);
                            
                        }else{
                        
                            questionEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Trivia Bot     Time Remaining: ${Math.max(sayac, 0)} second`, iconURL: botIcon})
                            .setTitle(`**${lobbyData.question}**`)
                            .addFields(
                                {name: '\n', value: '\n'},
                                {name: '\n', value: '\n'}
                            )
                            .setFooter({text: 'Difficulty Level ' + lobbyData.difficulty + '   |   Category ' + lobbyData.category})
                            .setColor('#0000FF');





                            let row1 = new ActionRowBuilder().addComponents(newLobby.answerButtons);

                            let kontrol = newLobby.answeredPlayers.some(player => player.id === interaction.user.id);

                            

                            if (kontrol) {

                                let userAnswer;
                                newLobby.answeredPlayers.forEach(player => {
                                    if (player.id === interaction.user.id) {
                                        userAnswer = player.answer;
                                    }
                                });

                                newLobby.newAnswerButtons = _.cloneDeep(newLobby.answerButtons);

                                let clickedButton = newLobby.newAnswerButtons.find(button => button.data.label == userAnswer);



                                if (clickedButton === undefined) {
                                    
                                }else{
                                    clickedButton.setLabel("🟢 " + userAnswer)
                                }


                                newLobby.newAnswerButtons = newLobby.newAnswerButtons.map(button => button.setDisabled(kontrol)); 
                                   
                                row1 = new ActionRowBuilder().addComponents(newLobby.newAnswerButtons);

                            }else{
                                row1 = new ActionRowBuilder().addComponents(newLobby.answerButtons);
                            }


                            // newLobby.newAnswerButtons = newLobby.answerButtons.map(button => button.setDisabled(kontrol));    
                            
                            interaction.editReply({content: '', embeds: [questionEmbed],components: [row1], ephemeral: true})
                        }


                    }, 1000); 

                    const participants = newLobby.participants
                    .map(playerId => ({
                        label: interaction.guild.members.cache.get(playerId)?.displayName || "Unknown Player",
                        value: playerId,
                    }));

                    newLobby.updatesQuestion++;
                    if (newLobby.updatesQuestion === participants.length) {
                        newLobby.updatesQuestion = 0;
                    }
                }
        }, newLobby.lobbyDuration*1000);

        //#endregion
 
    }

    async printLobby(interaction, Id) {
        while (true) {
            if (this.isChanged) {

                let newLobby;
                for (const lobby of lobbies) {
                    for (const player of lobby.participants) {
                        if (player === interaction.user.id) {
                            newLobby = lobby;
                        }
                    }
                }

                if (this.gameStart) {

                    const participants = this.participants
                    .map(playerId => ({
                        label: interaction.guild.members.cache.get(playerId)?.displayName || "Unknown Player",
                        value: playerId,
                    }));

                    this.updates++;
                    if (this.updates === participants.length) {
                        this.isChanged = false;
                        this.updates = 0;
                    }

                    if (this.gameType === 'First To Click') {





                        //#region ----FIRST REPLY------------------------------------------------------------------------------------------------------------

                        let lobbyData = this.lobbyDatas[this.questionIndex]

                        newLobby.correct_answer = lobbyData.correct_answer
                        
                        let questionEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Trivia Bot     Time Remaining: ${Math.max(this.lobbyDuration, 0)} second`, iconURL: botIcon})
                            .setTitle(`**${lobbyData.question}**`)
                            .addFields(
                                {name: '\n', value: '\n'},
                                {name: '\n', value: '\n'}
                            )
                            .setFooter({text: 'Difficulty Level ' + lobbyData.difficulty + '   |   Category ' + lobbyData.category})
                            .setColor('#0000FF');


                        this.answerButtons = lobbyData.answers.map((answer, currentQuestionIndex) => {
                            const option = String.fromCharCode('A'.charCodeAt(0) + currentQuestionIndex);
                    
                            return new ButtonBuilder()
                                .setCustomId(`answer_${option}`)
                                .setLabel(`${answer}`)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(false);
                        });
                        
                            let row1 = new ActionRowBuilder().addComponents(this.answerButtons);

                            let sayac = this.lobbyDuration
                            
                            let message = await interaction.editReply({content: '', embeds: [questionEmbed],components: [row1], ephemeral: true})



                                let sayacIntervel = setInterval(() => {             
                                    sayac--
                                    if (sayac == 0) {
                                        clearInterval(sayacIntervel);
                                    }else{
                                        questionEmbed = new EmbedBuilder()
                                        .setAuthor({ name: `Trivia Bot     Time Remaining: ${Math.max(sayac, 0)} second`, iconURL: botIcon})
                                        .setTitle(`**${lobbyData.question}**`)
                                        .addFields(
                                            {name: '\n', value: '\n'},
                                            {name: '\n', value: '\n'}
                                        )
                                        .setFooter({text: 'Difficulty Level ' + lobbyData.difficulty + '   |   Category ' + lobbyData.category})
                                        .setColor('#0000FF');


                                        let row1 = new ActionRowBuilder().addComponents(newLobby.answerButtons);

                                        let kontrol = newLobby.answeredPlayers.some(player => player.id === interaction.user.id);

                                        

                                        if (kontrol) {

                                            let userAnswer;
                                            newLobby.answeredPlayers.forEach(player => {
                                                if (player.id === interaction.user.id) {
                                                    userAnswer = player.answer;
                                                }
                                            });
    
                                            newLobby.newAnswerButtons = _.cloneDeep(newLobby.answerButtons);

                                            let clickedButton = newLobby.newAnswerButtons.find(button => button.data.label == userAnswer);



                                            if (clickedButton === undefined) {
                                                
                                            }else{
                                                clickedButton.setLabel("🟢 " + userAnswer)
                                            }


                                            newLobby.newAnswerButtons = newLobby.newAnswerButtons.map(button => button.setDisabled(kontrol)); 
                                               
                                            row1 = new ActionRowBuilder().addComponents(newLobby.newAnswerButtons);

                                        }else{
                                            row1 = new ActionRowBuilder().addComponents(newLobby.answerButtons);
                                        }


                                        // newLobby.newAnswerButtons = newLobby.answerButtons.map(button => button.setDisabled(kontrol));    
                                        
                                        interaction.editReply({content: '', embeds: [questionEmbed],components: [row1], ephemeral: true})
                                    }

                                },1000)

                            //#endregion

                        newLobby.printFirstToClick(interaction)









                        
                        const collector = message.createMessageComponentCollector({});

                        collector.on('collect', async (interactionLobby) => {   
                            interactionLobby.deferUpdate();
                            let userAnswer = interactionLobby.component.label

                            



                            
                            newLobby.answeredPlayers.push({id: interactionLobby.user.id, answer: userAnswer})


                            console.log("butoona tıklayan kişi")
                            console.log(interactionLobby.user.globalName)
                            console.log("-  -   -   -   -   -")
                            console.log(newLobby.correct_answer)






                            
                           
                            if (userAnswer === newLobby.correct_answer) {

                                const playerScore = newLobby.playerScores.find(playerScore => playerScore.id === interactionLobby.user.id);
                                if (playerScore) {
                                    playerScore.score += 1;
                                }
                                
                                console.log(newLobby.playerScores)
                                console.log("--111--")
                                newLobby.answerButtons = newLobby.answerButtons.map(button => button.setDisabled(true));      
                            }



                        })

                    }











                    if (this.gameType === 'Most Scored') {
                        newLobby.printMostScored(interaction)
                    }










                } 
                else{

                    //#region ----PRINT LOBBY--------------------------------------------------------------------------------------

                    const isUserInPlayers = this.participants.some(player => player === interaction.user.id);
                    const isKickPlayers = this.kickPlayer.some(player => player === interaction.user.id);

                    if (isKickPlayers) {

                        let kickEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                        .setTitle(`
                        You have been kicked from the lobby !
                        `)
                        .setImage('https://media.giphy.com/media/k7JLRHYxe47Ek/giphy.gif')
                        .setColor('#bf0000')
                        .setTimestamp()
    
                        await interaction.editReply({ embeds: [kickEmbed], components: [], ephemeral: true });
                        return;
                    }

                    if (!isUserInPlayers) {
                        return;
                    }

                    const owner = await client.users.fetch(this.ownerId);

                    let playerList = this.participants.map(playerId => {
                        const player = client.users.fetch(playerId);
                        const isHost = playerId === this.hostId;
                        const isReady = this.readyPlayers.includes(playerId);
                        const hostEmoji = isHost ? '<:crown:123456789012345678>' : '';
                        const readyEmoji = isReady && !isHost ? '✅' : ''; 
                    
                        return `${hostEmoji} ${readyEmoji} ${player ? `<@${playerId}>` : "Unknown Player"}`;
                    }).join('\n');  

                    let lobbyEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Owner: @${owner.globalName} `, iconURL: owner.displayAvatarURL() })
                        .setTitle(this.name)
                        .setDescription(`**Game Mode:**  ${this.gameType} \n **Question Count: **${this.lobbyAmount} \n **Lobby Type:** ${this.isPrivate ? 'Private' : 'Public'} \n\n **Players:**\n${playerList}`)
                        .setFooter({ text: `Player Count: ${this.participants.length}/${this.maxParticipants}` })
                        .setColor('#FF4656');
            
                    let rowLobby3 = new ActionRowBuilder();

                        if (interaction.user.id === newLobby.hostId) {
                            const startButton = new ButtonBuilder()
                                .setCustomId('startButton')
                                .setLabel('Start')
                                .setStyle(ButtonStyle.Primary);
                        
                            rowLobby3.addComponents(startButton);
                        } else {
                            const readyButton = new ButtonBuilder()
                                .setCustomId('readyButton')
                                .setLabel('Ready')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(this.readyPlayers.includes(interaction.user.id));

                            rowLobby3.addComponents(readyButton);
                        }

                        const leaveButton = new ButtonBuilder()
                            .setCustomId('leaveButton')
                            .setLabel('Leave')
                            .setStyle(ButtonStyle.Danger);
                        
                        rowLobby3.addComponents(leaveButton);
                        
                    const selectMenu1 = new StringSelectMenuBuilder()
                        .setDisabled(interaction.user.id !== this.hostId) 
                        .setCustomId('lobbyChoice')
                        .setPlaceholder('Choose setting you want to configure')
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setEmoji('⚔️')
                                .setLabel(`Game Mode: ${this.secondaryGameType}`)
                                .setValue('changeGameMode'),
                            new StringSelectMenuOptionBuilder()
                                .setEmoji('🌐')
                                .setLabel(`Lobby Type: ${this.secondaryLobbyType ? 'Private' : 'Public'}`)
                                .setValue('changeLobbyMode'),
                            new StringSelectMenuOptionBuilder()
                                .setEmoji('📝')
                                .setLabel('Question Amount')
                                .setValue('questionAmount'),
                            new StringSelectMenuOptionBuilder()
                                .setEmoji("⏲️")
                                .setLabel('Question Duration')
                                .setValue('questionDuration'),
                        );
            
                    const participants = this.participants
                    .map(playerId => ({
                        label: interaction.guild.members.cache.get(playerId)?.displayName || "Unknown Player",
                        value: playerId,
                    }));
            
            
                    const selectHost = new StringSelectMenuBuilder()
                        .setDisabled(interaction.user.id !== this.hostId) 
                        .setCustomId('hostChoice')
                        .setPlaceholder('Choose the player to transfer the host role')
                        .addOptions(...participants);

                    const selectKick = new StringSelectMenuBuilder()
                        .setDisabled(interaction.user.id !== newLobby.hostId) 
                        .setCustomId('kickChoice')
                        .setPlaceholder('Select the user you want to kick.')
                        .addOptions(...participants);

                let rowLobby1 = new ActionRowBuilder().addComponents(selectMenu1);
                let rowLobby2 = new ActionRowBuilder().addComponents(selectHost);
                let rowLobby4 = new ActionRowBuilder().addComponents(selectKick)
                    
                    interaction.editReply({content: '', embeds: [lobbyEmbed], components: [rowLobby1, rowLobby2, rowLobby4, rowLobby3],  ephemeral: true });

                    //#endregion

                    this.updates++;
                    if (this.updates > ++participants.length) {
                        this.isChanged = false;
                        this.updates = 0;
        
                    }
                }
            }
        await wait(200)        
        }
    }
}
const lobbies = [];

//#endregion

//#region --PROFILE--------------------------------------------------------------------------------------------------------------

class ProfileManager {
    constructor() {
        this.profiles = this.loadProfiles();
    }

    loadProfiles() {
        try {
            const data = fs.readFileSync('profiles.json');
            return JSON.parse(data);
        } catch (error) {
            console.error('An error occurred while loading the profile file:', error);
            return [];
        }
    }

    saveProfiles() {
        try {
            const jsonData = JSON.stringify(this.profiles, null, 2);
            fs.writeFileSync('profiles.json', jsonData);
        } catch (error) {
            console.error('An error occurred while saving the profile file:', error);

        }
    }

    getProfile(userId) {
        const existingProfile = this.profiles.find(profile => profile.userId === userId);
        return existingProfile;
    }

    createProfile(userId) {
        const newProfile = {
            userId: userId,
            xp: 0,
            level: 1,
            total_xp: 0,
            badges: [0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0]
        };
        this.profiles.push(newProfile);
        this.saveProfiles();
        return newProfile;
    }

    updateProfile(userId, xp, categoryIndex) {
        const existingProfile = this.getProfile(userId);

        if (existingProfile) {
            existingProfile.xp += xp;
            existingProfile.total_xp += xp;
            existingProfile.badges[categoryIndex] += xp;

            let requiredXp = 10 * Math.pow(2, existingProfile.level-1);

            while (existingProfile.xp >= requiredXp) {
                existingProfile.xp -= requiredXp
                existingProfile.level += 1;

                requiredXp = 10 * Math.pow(2, existingProfile.level-1);
            }

            this.saveProfiles();
        }
    }
}

const profileManager = new ProfileManager();

//#endregion

//#region ---CLASS TRIVIA--------------------------------------------------------------------------------------------------------

class TriviaApi {
    constructor(apiUrl, gameMode, testNumber) {
        this.apiUrl = apiUrl;
        this.datas = [];
        this.gameMode = gameMode;
        this.testNumber = testNumber;
        this.duration = 0;
        this.timerInterval = null;
        this.answerButtons = [];
    }

    async fetchQuestions(amount, difficulty = '', category = '') {
        try {
            let apiUrlWithParams
            if (difficulty == null && category == null) apiUrlWithParams = `${this.apiUrl}?amount=${amount}`;   
            if (difficulty != null && category == null) apiUrlWithParams = `${this.apiUrl}?amount=${amount}&difficulty=${difficulty}`;
            if (difficulty == null && category != null) apiUrlWithParams = `${this.apiUrl}?amount=${amount}&category=${category}`;
            if (difficulty != null && category != null) apiUrlWithParams = `${this.apiUrl}?amount=${amount}&category=${category}&difficulty=${difficulty}`;
            
            const response = await fetch(apiUrlWithParams);
            const data = await response.json();

            this.datas = data.results.map(question => {
                question.isAnswered = false; 
                question.isCorrect = ""; 
                question.userAnswer = "";

                const correctAnswerIndex = Math.floor(Math.random() * (question.incorrect_answers.length + 1));
                const answers = [...question.incorrect_answers];
                answers.splice(correctAnswerIndex, 0, question.correct_answer);
    
                question.answers = answers;

                question.question = he.decode(question.question);
                question.correct_answer = he.decode(question.correct_answer);
                question.incorrect_answers = question.incorrect_answers.map(answer => he.decode(answer));
                question.category = he.decode(question.category);
                

                return question;
            })

        } catch (error) {
            console.error('Data retrieval error:', error);
        }
    }

    async printQuestions(interaction, currentQuestionIndex, gameMode, testNumber) {
        
        data = this.datas[currentQuestionIndex];
        
        let questionEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
        .setTitle(data.question)
        .addFields(
            {name: '\n', value: '\n'},
            {name: '\n', value: '\n'}
        )
        .setFooter({text: 'Difficulty Level ' + data.difficulty + '   |   Category ' + data.category})
        .setColor('#0000FF');
    

        //#region --SELECT MENÜ--------------------------------------------------------------------------------------------------

        let QuestionList = triviaApi.datas.map((question, index) => {
            let QuestionEmoji = question.isAnswered ? (question.isCorrect ? '✅' : '❌') : '❓';
            QuestionEmoji = (index === currentQuestionIndex) ? '⏸️' : QuestionEmoji;
        
            return new StringSelectMenuOptionBuilder()
                .setLabel(`Question: ${index + 1}`)
                .setValue(index.toString())
                .setEmoji(QuestionEmoji);
            
        });

        //#endregion

        //#region --BUTTONS-----------------------------------------------------------------------------------------------------

        this.answerButtons = data.answers.map((answer, currentQuestionIndex) => {
            const option = String.fromCharCode('A'.charCodeAt(0) + currentQuestionIndex);

            return new ButtonBuilder()
                .setCustomId(`answer_${option}`)
                .setLabel(`${answer}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(false);
        });

        let correctButton;
        for (const button of this.answerButtons) {
            if (button.data.label === data.correct_answer) {
                correctButton = button;
                break; 
            }
        }

        let nextButton = new ButtonBuilder()
            .setCustomId('nextButton')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Primary);

        if (currentQuestionIndex >= triviaApi.datas.length - 2) {
            nextButton
            .setLabel('Last ➡️')
        }
        if (currentQuestionIndex >= triviaApi.datas.length - 1) {
            nextButton
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
            .setLabel('🚫')
        } 
        let backButton = new ButtonBuilder()
            .setCustomId('backButton')
            .setLabel('⬅️ Previous')
            .setStyle(ButtonStyle.Primary);
        if(currentQuestionIndex == 0){
            backButton
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('🚫')
        }
        else{
            backButton
            .setDisabled(false)
            .setStyle(ButtonStyle.Primary)
            .setLabel('⬅️ Previous')
        }

        let saveButton = new ButtonBuilder()
            .setCustomId('saveButton')
            .setLabel("Save")
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')

        //#endregion

        // timed
        if(gameMode === 'timed'){
            if(!data.isAnswered){
                nextButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
                backButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
            }
            clearInterval(this.timerInterval);
            this.duration = interaction.options.getInteger('duration'); 

            this.timerInterval = setInterval(() => {

                interaction.editReply({ content: `Time Remaining: ${Math.max(this.duration, 0)} second`,  ephemeral: true });
                this.duration--;

                if (this.duration == -1) {
                    
                    const disabledanswerButtons = this.answerButtons.map(button => button.setDisabled(true));
                    row1.setComponents(disabledanswerButtons);
                    interaction.editReply({ embeds: [questionEmbed], components: [row0, row1, row2, row4], ephemeral: true });

                    clearInterval(this.timerInterval);

                    if(currentQuestionIndex != 0){
                        backButton.setStyle(ButtonStyle.Primary).setDisabled(false);
                    }
                    if(currentQuestionIndex != this.datas.length -1){
                        nextButton.setStyle(ButtonStyle.Primary).setDisabled(false);
                    }

                row2.setComponents([backButton, nextButton]);
                interaction.editReply({ embeds: [questionEmbed], components: [row0, row1, row2, row4],  ephemeral: true });
                }
            }, 1000);
            
        }

        const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('questionSelection')
        .setPlaceholder(`Question ${currentQuestionIndex + 1}`)
        .addOptions(QuestionList);

        let row0 = new ActionRowBuilder().addComponents(selectMenu);
        let row1 = new ActionRowBuilder().addComponents(this.answerButtons);
        let row2 = new ActionRowBuilder().addComponents([backButton, nextButton]);
        let row4 = new ActionRowBuilder().addComponents(saveButton)

        let clickedButton, clickedButtonLabel;

        if (data.isAnswered) {
            clickedButtonLabel = data.userAnswer

            clickedButton = this.answerButtons.find(button => button.data.label === data.userAnswer);

            clickedButton.setStyle(ButtonStyle.Danger);
            correctButton.setStyle(ButtonStyle.Success);

            const disabledanswerButtons = this.answerButtons.map(button => button.setDisabled(true));
            row1.setComponents(disabledanswerButtons);
            await interaction.editReply({ embeds: [questionEmbed], components: [row0, row1, row2, row4], ephemeral: true });

            data.buttonsDisabled = true;
            
            clearInterval(triviaApi.timerInterval);
        }
        
        let message = await interaction.editReply({ embeds: [questionEmbed], components: [row0, row1, row2, row4],  ephemeral: true });
        
        const collector = await message.createMessageComponentCollector({});
        
        //#region ---COLLECTOR---------------------------------------------------------------------------------------------------------        
        collector.on('collect', async (buttonInteraction) => {    
            if (buttonInteraction.customId === 'questionSelection') {
                buttonInteraction.deferUpdate()
                
                const selectedQuestionIndex = parseInt(buttonInteraction.values[0]);
                
                currentQuestionIndex = selectedQuestionIndex;
                await triviaApi.printQuestions(interaction, currentQuestionIndex, gameMode, testNumber);
                collector.stop();
            }
            
            if (buttonInteraction.customId.startsWith('answer_')) {
                buttonInteraction.deferUpdate() 
                
                
                if(gameMode === 'timed'){
                    if(currentQuestionIndex != 0){
                        backButton.setStyle(ButtonStyle.Primary).setDisabled(false);
                    }
                    if(currentQuestionIndex != this.datas.length -1){
                        nextButton.setStyle(ButtonStyle.Primary).setDisabled(false);
                    }
            
                    row2.setComponents([backButton, nextButton]);

                    clearInterval(triviaApi.timerInterval);
                }
                
                clickedButtonLabel = buttonInteraction.component.label;  
                clickedButton = this.answerButtons.find(button => button.data.label === clickedButtonLabel); 
                const isCorrect = correctButton && correctButton.data.label === clickedButtonLabel;
                
                const targetIndex = triviaApi.datas.findIndex(item => item.question === data.question);
                
                if (targetIndex !== -1) {
                    triviaApi.datas[targetIndex].isAnswered = true; 
                    triviaApi.datas[targetIndex].isCorrect = isCorrect;
                    triviaApi.datas[targetIndex].userAnswer = clickedButtonLabel;
                    
                }
                
                clickedButton.setStyle(ButtonStyle.Danger).setDisabled(true);
                correctButton.setStyle(ButtonStyle.Success);
                
                const disabledanswerButtons = this.answerButtons.map(button => button.setDisabled(true));
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('questionSelection')
                    .setPlaceholder('Choose a question!')
                    .addOptions(QuestionList)
                
                row0 = new ActionRowBuilder().addComponents(selectMenu);
                
                row1.setComponents(disabledanswerButtons);
                
                saveAnswerToJson(userId, gameMode, testNumber);
                
                await triviaApi.printQuestions(interaction, currentQuestionIndex, gameMode, testNumber);

                const categoryMapping = {
                    'General Knowledge': '9',
                    'Entertainment: Books': '10',
                    'Entertainment: Film': '11',
                    'Entertainment: Music': '12',
                    'Entertainment: Musicals & Theatres': '13',
                    'Entertainment: Television': '14',
                    'Entertainment: Video Games': '15',
                    'Entertainment: Board Games': '16',
                    'Science & Nature': '17',
                    'Science: Computers': '18',
                    'Science: Mathematics': '19',
                    'Mythology': '20',
                    'Sports': '21',
                    'Geography': '22',
                    'History': '23',
                    'Politics': '24',
                    'Art': '25',
                    'Celebrities': '26',
                    'Animals': '27',
                    'Vehicles': '28',
                    'Entertainment: Comics': '29',
                    'Science: Gadgets': '30',
                    'Entertainment: Japanese Anime & Manga': '31',
                    'Entertainment: Cartoon & Animations': '32'
                  };
                  
                  const categoryIndex = categoryMapping[data.category];

                if (isCorrect) {
                    let earnedXp = 1;
                    if(gameMode == 'timed'){
                        if (this.duration <= 7) {
                            earnedXp = 4;
                        }
                        else if (this.duration <= 12) {
                            earnedXp = 3;
                        }
                        else if (this.duration <= 17) {
                            earnedXp = 2;
                        }
                    }

                    profileManager.updateProfile(userId, earnedXp, categoryIndex);
                    

                } else {
                }
                collector.stop()
            }           

            if (buttonInteraction.customId === 'nextButton') {
                buttonInteraction.deferUpdate()
                currentQuestionIndex++; 
                
                await triviaApi.printQuestions(interaction, currentQuestionIndex, gameMode, testNumber);
                if (currentQuestionIndex >= triviaApi.datas.length) {
                    buttonInteraction.deferUpdate()
                    return;
                }
                collector.stop()        
                return
            } 

            if (buttonInteraction.customId === 'backButton') {
                buttonInteraction.deferUpdate()
                currentQuestionIndex--;
                if (currentQuestionIndex < 0) {
                    currentQuestionIndex = 0;
                    return;
                }
                await triviaApi.printQuestions(interaction, currentQuestionIndex, gameMode, testNumber);
                collector.stop()
                return  
            }

            if(buttonInteraction.customId === 'saveButton'){    

                const successEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'Trivia Bot', iconURL: botIcon})
                    .setTitle('Successfully Saved!')
                    .setDescription("To access your saved trivia files, you can use the '/trivia-files' command.")
                    .setThumbnail('https://media.tenor.com/LEhC5W9BQBIAAAAj/svtl-transparent.gif')
                    .setColor('#00ff00'); 
                
                await interaction.followUp({ embeds: [successEmbed] , ephemeral: true });
                await buttonInteraction.deferUpdate()
                collector.stop()
                return
            }
        })
        //#endregion
    }
}
const triviaApi = new TriviaApi(apiUrl, gameMode, testNumber);

//#endregion

//#endregion

client.login(token);