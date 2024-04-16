const { Client, GatewayIntentBits, SlashCommandBuilder, StringSelectMenuBuilder } = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST, Routes } = require("discord.js");
const fs = require('fs');
const scoresPath = './scores.json';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { clientId, guildId, token, laddersHostedChannelId, ticketChannelId, zoneWarsChannelId, AdminChannelId, hostedRequirement, ticketRequirement, zoneWarsRequirement, staffRole } = require('./config.json');

const commands = [

    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('setup'),

    new SlashCommandBuilder()
        .setName('my-profile')
        .setDescription('my-profile'),

    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Shows the profile of a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select a user')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('activity-check')
        .setDescription('Use this bot to check all-time, past 14 days, and past 7 days activities.')
        .addStringOption((option) =>
            option
                .setName('time')
                .setRequired(true)
                .setDescription('Select which leaderboard you want to check.')
                .addChoices(
                    { name: 'Past 7 Days', value: 'last7Days' },
                    { name: 'Past 14 Days', value: 'last14Days' },
                    { name: 'All-time', value: 'total' },
                )
        ),

    new SlashCommandBuilder()
        .setName('change-requirement')
        .setDescription('change-requirement')
        .addStringOption(option =>
            option
                .setName('requirement')
                .setRequired(true)
                .setDescription('Select the requirement you want to change.')
                .addChoices(
                    { name: 'Games Requirement', value: 'hostedRequirement' },
                    { name: 'ZoneWars Requirement', value: 'zoneWarsRequirement' },
                    { name: 'Ticket Requirement', value: 'ticketRequirement' },
                )
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Eter the required value you want')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('break-request')
        .setDescription('Use this command to send a break request to the admins')
        .addIntegerOption(option =>
            option
                .setName('day')
                .setDescription('Enter how many days you have a break request')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Enter your reason')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('leaderboards')
        .setDescription('Use this bot to check all-time and past 7 days leaderboards.')
        .addStringOption(option =>
            option
                .setName('leaderboards-channel')
                .setRequired(true)
                .setDescription('Select the channel')
                .addChoices(
                    { name: 'Ladder', value: 'laddersHosted' },
                    { name: 'ZoneWars', value: 'zoneWarsHoste' },
                    { name: 'Ticket', value: 'ticketLogs' },
                )
        )
        .addStringOption((option) =>
            option
                .setName('leaderboards-time')
                .setRequired(true)
                .setDescription('Select which leaderboard you want to check.')
                .addChoices(
                    { name: 'Past 7 Days', value: 'last7Days' },
                    { name: 'All-time', value: 'total' },
                )
        )



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

client.on('ready', () => {
    console.log(`---Logged in as ${client.user.tag}!---`);

    client.guilds.cache.forEach(guild => {

        guild.members.fetch().then(members => {
            members.forEach(member => {
                if (member.roles.cache.has(staffRoleG)) {

                    const userId = member.user.id;
                    const data = readScores();

                    let userData = data.usersData.find(u => u.userId === userId);

                    if (userData) {
                    } else {

                        const today = new Date().toISOString().slice(0, 10);

                        data.usersData.push({
                            userId: userId,
                            joined: today,
                            warnedAndBreak: {
                                warned: false,
                                warnedTimes: 0,
                                break: false,
                                reason: "",
                                breakDays: {}
                            },
                            channels: channelIds.reduce((obj, channelId) => {
                                obj[channelId] = {
                                    scores: { removedScores: 0 },
                                    boards: { total: 0, last7Days: 0, last14Days: 0 }
                                };
                                return obj;
                            }, {})
                        });
                        writeScores(data);
                    }

                }
            });
        }).catch(console.error);
    });


    updateScoresPeriodically();
});

let targetChannelId;
let targetChannelName;

let laddersHostedChannelIdG = laddersHostedChannelId;
let ticketChannelIdG = ticketChannelId;
let zoneWarsChannelIdG = zoneWarsChannelId;
let AdminChannelIdG = AdminChannelId;

let GuildIDG = guildId;
let staffRoleG = staffRole;

let hostedRequirementG = hostedRequirement
let ticketRequirementG = ticketRequirement
let zoneWarsRequirementG = zoneWarsRequirement

let guild = client.guilds.cache.get(GuildIDG);

client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'leaderboards') {
        const targetChannel = interaction.options.getString('leaderboards-channel');
        const timeSelection = interaction.options.getString('leaderboards-time');

        const data = readScores();
        const usersData = data.usersData;

        let filteredScores = [];

        for (const user of usersData) {
            const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
            if (!member || !member.roles.cache.has(staffRole)) continue;

            const channels = user.channels[targetChannel];
            if (channels) {
                const scores = channels.boards;
                const score = scores[timeSelection] || 0;

                filteredScores.push({ userId: user.userId, score: score });
            }
        }

        filteredScores.sort((a, b) => b.score - a.score);

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
            .setColor(0x0099ff)
            .setTitle(`${targetChannel.charAt(0).toUpperCase() + targetChannel.slice(1)} Leaderboards`)
            .setTimestamp()
            .setFooter({ text: 'Leaderboard System' });

        if (filteredScores.length === 0) {
            embed.setDescription('User not found.');
        } else {
            let description = '';
            let i = 0
            filteredScores.forEach(userScore => {
                i++
                description += `**${i}-** <@${userScore.userId}>**:**  **${userScore.score}**\n`;
            });
            embed.setDescription(description);
        }

        await interaction.reply({ embeds: [embed] });
    }
});



client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'change-requirement') {

        const requirementSelection = interaction.options.getString('requirement');
        const amountSelectiın = interaction.options.getInteger('amount')

        const configPath = './src/config.json';
        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);

        config[requirementSelection] = `${amountSelectiın}`;

        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

        if (requirementSelection === 'hostedRequirement') {
            hostedRequirementG = `${amountSelectiın}`;
        }
        if (requirementSelection === 'zoneWarsRequirement') {
            zoneWarsRequirementG = `${amountSelectiın}`;
        }
        if (requirementSelection === 'ticketRequirement') {
            ticketRequirementG = `${amountSelectiın}`;
        }



        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setTitle("**The requirement has been successfully changed**")
            .setDescription(`${requirementSelection} = ${amountSelectiın}`)
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp()
            .setColor('00ff00')

        await interaction.reply({ embeds: [embed], components: [] });

    }
})



client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'activity-check') {
        const timeSelection = interaction.options.getString('time');
        const data = readScores();
        let successfulUsers = [];
        let failedUsers = [];
        let warnedUsersIds = [];

        for (const user of data.usersData) {
            const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
            if (!member || !member.roles.cache.has(staffRoleG)) continue;
            const channelScores = user.channels;
            let userDetails = `<@${user.userId}> `;
            let userId = user.userId;
            let totalActivities = 0;
            let failedRequirements = [];
            let warned = user.warnedAndBreak.warned;

            for (const channelName in channelScores) {
                const activities = channelScores[channelName].boards[timeSelection];
                totalActivities += activities;
                let displayName = channelName;
                if (channelName === 'laddersHosted') displayName = 'Games';
                else if (channelName === 'ticketLogs') displayName = 'Tickets';
                else if (channelName === 'zoneWarsHosted') displayName = 'Zonewars';

                userDetails += `**${activities}** ${displayName},  `;

                if (timeSelection === 'last7Days') {
                    if (channelName.toLowerCase().includes('hosted') && activities < hostedRequirementG ||
                        channelName.toLowerCase().includes('ticket') && activities < ticketRequirementG ||
                        channelName.toLowerCase().includes('zonewars') && activities < zoneWarsRequirementG) {
                        failedRequirements.push(`${activities} ${channelName}`);
                    }
                }
            }

            userDetails = userDetails.replace(/, $/, '');

            if (timeSelection === 'last7Days' && failedRequirements.length > 0) {
                if (warned) {
                    userDetails += ' (W)';
                    warnedUsersIds.push(user.userId);
                }
                failedUsers.push({ userDetails, totalActivities, userId });
            } else {
                successfulUsers.push({ userDetails, totalActivities, userId });
            }
        }


        for (const successfulUser of successfulUsers) {
            const userId = successfulUser.userId;
            const data = readScores(); 
            const userIndex = data.usersData.findIndex(user => user.userId === userId);
            if (userIndex !== -1 && data.usersData[userIndex].warnedAndBreak.warned) {
                data.usersData[userIndex].warnedAndBreak.warned = false; 
        
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const warnedRole = member.guild.roles.cache.find(role => role.name === "warned");
                    if (warnedRole && member.roles.cache.has(warnedRole.id)) {
                        await member.roles.remove(warnedRole).catch(console.error); 
                    }
                }
            }
            writeScores(data);
        }
        
        successfulUsers.sort((a, b) => b.totalActivities - a.totalActivities);
        failedUsers.sort((a, b) => b.totalActivities - a.totalActivities);

        let timeSelectionText = '';
        let actionRow = null;
        switch (timeSelection) {
            case 'last7Days':
                timeSelectionText = 'Weekly';

                actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('warnUser')
                            .setLabel('Warn')
                            .setStyle(ButtonStyle.Danger)
                    );
                break;
            case 'last14Days':
                timeSelectionText = '14-Day';
                break;
            case 'total':
                timeSelectionText = 'All-time';
                break;
            default:
                timeSelectionText = 'Custom';
                break;
        }

        let description = `**Passed ${timeSelectionText} Requirements (Sorted H to L):**\n`;
        description += successfulUsers.length ? successfulUsers.map(user => user.userDetails).join('\n') : 'No users have passed the requirements.';

        let failedDescription = '';
        if (timeSelection === 'last7Days') {
            failedDescription = `**Failed ${timeSelectionText} Requirements: (W = Warned Prev) **\n`;
            failedDescription += failedUsers.length ? failedUsers.map(user => user.userDetails).join('\n') : 'No users have failed the requirements.';
        }

        let finalDescription = description + (failedDescription ? '\n\n\n' + failedDescription : '');

        const activityEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`Activity Checks (${timeSelectionText})`)
            .setDescription(finalDescription)
            .setTimestamp();

        let message

        if (actionRow) {
            message = await interaction.reply({ embeds: [activityEmbed], components: [actionRow], ephemeral: false });
        } else {
            message = await interaction.reply({ embeds: [activityEmbed], ephemeral: false });
        }

        const collector = message.createMessageComponentCollector({});

        collector.on('collect', async (interaction) => {

            if (interaction.customId === 'warnUser') {

                message.delete();

                let info = []
                let userIds = []


                failedUsers.forEach(user => {
                    const data = readScores();
                    const id = user.userId;
                    const user0 = data.usersData.find(user => user.userId === id);
                    const warnedTimes = user0.warnedAndBreak.warnedTimes
                    info.push({ id, warnedTimes })

                });



                failedUsers.forEach(user => {
                    const userId = user.userId;
                    userIds.push({ userId })

                });

                staffRoleRemove(warnedUsersIds)

                warnedPlayers(userIds)


                actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('warnUser')
                            .setEmoji('☑️')
                            .setDisabled(true)
                            .setStyle(ButtonStyle.Success)
                    );

                await interaction.reply({ embeds: [activityEmbed], components: [actionRow], ephemeral: false });
            }
        })
    }
})

async function staffRoleRemove(userIds) {

    
    const guild = await client.guilds.fetch(GuildIDG);
    const role = await guild.roles.fetch(staffRoleG);

    // Her bir kullanıcı ID'si için döngü
    for (const userId of userIds) {
        try {
            const member = await guild.members.fetch(userId);
            await member.roles.remove(role);
        } catch (error) {
            console.error(error);
        }
    }
}


async function warnedPlayers(userIds) {
    let roleName = 'warned';
    const guild = client.guilds.cache.get(GuildIDG);
    let role = guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
        try {
            role = await guild.roles.create({
                name: roleName,
                color: "#ffe413",
                permissions: []
            });
        } catch (error) {
            console.error(`An error occurred while creating the role: ${error}`);
            return;
        }
    }

    const scoresData = readScores();

    for (let userId of userIds) {

        let activeWarned;

        let targetId = userId.userId

        let member;
        try {
            member = await guild.members.fetch(targetId);
        } catch (error) {
            console.error(`An error occurred while finding the user: ${userId}, Error: ${error}`);
            continue;
        }

        if (member) {
            await member.roles.add(role);

            const userIndex = scoresData.usersData.findIndex(user => user.userId === targetId);
            if (userIndex !== -1) {
                activeWarned = scoresData.usersData[userIndex].warnedAndBreak.warned
                scoresData.usersData[userIndex].warnedAndBreak.warned = true;
                scoresData.usersData[userIndex].warnedAndBreak.warnedTimes += 1;
            } else {
                scoresData.usersData.push({
                    userId: targetId,
                    warnedAndBreak: {
                        warned: true,
                        warnedTimes: 1,
                        break: false,
                        reason: "",
                        breakDays: {}
                    },
                    channels: channelIds.reduce((obj, channelId) => {
                        obj[channelId] = {
                            scores: { removedScores: 0 },
                            boards: { total: 0, last7Days: 0, last14Days: 0 }
                        };
                        return obj;
                    }, {})
                });
            }


            if (!activeWarned) {
                const user = client.users.cache.get(targetId);
                const embed = new EmbedBuilder()
                    .setColor('#cd0000')
                    .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`Hey, you have been warned for not meeting the weekly minimum activity requirements. Increase your activity levels or you'll be demoted. https://discord.com/channels/1078418822584881222/1083765029960159333/1095142062229303316`)
                    .setFooter({ text: 'If you think this is a mistake, please dm @misbah0110' })
                    .setTimestamp();

                try {
                    await user.send({ embeds: [embed] });
                } catch (error) {
                }
            }
        }
    }

    writeScores(scoresData);
}


client.on('messageCreate', message => {

    // const guild = client.guilds.cache.get(GuildIDG);

    if (message.channel.id === laddersHostedChannelId || message.channel.id === laddersHostedChannelIdG) {
        message.embeds.forEach(embed => {
            if (embed.title === 'Custom Game Matchmaking Result') {
                const hostField = embed.fields.find(field => field.name === 'Host');
                if (hostField) {

                    const parts = hostField.value.split('/');
                    if (parts.length > 1) {
                        const userId = parts[1].trim();
                        updateScore(userId, "laddersHosted");
                    } else {
                    }
                } else {
                }
            }
        });
    }

    
    if (message.channel.id === ticketChannelId || message.channel.id === ticketChannelIdG) {

        message.embeds.forEach(async embed => {
            const loggedInfoField = embed.fields.find(field => field.name === 'Logged Info');
            if (loggedInfoField) {
    
                const authorInfo = embed.author ? embed.author.name : 'dont have';
                let username = authorInfo.slice(0, -2);
                
                let userId;
                await message.guild.members.fetch().then(members => {
                    members.forEach(member => {
                        if (member.user.username === username) {
                            userId = member.user.id;
                            updateScore(userId, "ticketLogs");
                        }
                    });
                }).catch(error => {
                    console.error('Error fetching members:', error);
                });
            }
        });
    }



    if (message.channel.id === zoneWarsChannelId || message.channel.id === zoneWarsChannelIdG) {
        message.embeds.forEach(embed => {
            if (embed.title === 'Custom Game Matchmaking Result') {
                const hostField = embed.fields.find(field => field.name === 'Host');
                if (hostField) {
                    const parts = hostField.value.split('/');
                    if (parts.length > 1) {
                        const userId = parts[1].trim();
                        updateScore(userId, "zoneWarsHoste");
                    } else {
                    }
                } else {
                }
            }
        });
    }

});




client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const configPath = './src/config.json';
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);

    GuildIDG = interaction.guildId

    config.guildId = GuildIDG;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');



    if (commandName === 'setup') {

        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setTitle('Please select the channel you want to setup')
            .addFields({ name: "\n", value: "\n" })
            .setColor('ffde66')
            .setTimestamp()

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select-target')
                    .addOptions([
                        {
                            label: 'Ladders Hosted Channel',
                            value: 'laddersHostedChannelId',
                        },
                        {
                            label: 'Ticket Logs Channel',
                            value: 'ticketChannelId',
                        },
                        {
                            label: 'Zone Wars Channel',
                            value: 'zoneWarsChannelId',
                        },
                        {
                            label: 'Admin Channel',
                            value: 'AdminChannelId',
                        },
                    ]));

        await interaction.reply({ embeds: [embed], components: [row] })
    }
});

client.on('interactionCreate', async interaction => {

    if (interaction.customId === 'select-target') {

        targetChannelId = interaction.values[0];

        if (targetChannelId == 'laddersHostedChannelId') {
            targetChannelName = 'Ladders Hosted Channel'
        }
        if (targetChannelId == 'ticketChannelId') {
            targetChannelName = 'Ticket Logs Channel'
        }
        if (targetChannelId == 'zoneWarsChannelId') {
            targetChannelName = 'Zone Wars Channel'
        }
        if (targetChannelId == 'AdminChannelId') {
            targetChannelName = 'Admin Channel'
        }


        const categories = interaction.guild.channels.cache
            .filter(channel => channel.type === 4)
            .map(category => ({
                label: category.name,
                value: category.id
            }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select-category')
                    .setPlaceholder('Please select a category')
                    .addOptions(categories),
            );

        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setTitle(`**Step 1/2 for ${targetChannelName}**`)
            .setDescription('** Please select a category **')
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp()
            .setColor('ffde66')

        await interaction.update({ embeds: [embed], components: [row] });
    }

    else if (interaction.customId === 'select-category') {

        const categoryId = interaction.values[0];

        const categoryChannels = interaction.guild.channels.cache
            .filter(channel => channel.parentId === categoryId)
            .map(channel => ({
                label: channel.name,
                value: channel.id
            }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select-channel')
                    .setPlaceholder('Please select a channel')
                    .addOptions(categoryChannels),
            );

        const embed = new EmbedBuilder()
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setTitle(`**Step 2/2 for ${targetChannelName}**`)
            .setDescription('** Please select a channel **')
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp()
            .setColor('ffde66')

        await interaction.update({ embeds: [embed], components: [row] });
    }

    else if (interaction.customId === 'select-channel') {
        const selectedChannelId = interaction.values[0];

        const configPath = './src/config.json';
        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);

        if (config.targetChannelId) {

            const embed = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle(`**${targetChannelName}  controller has been successfully edited**`)
                .setDescription('It is enough to perform the same operations to change the controller')
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp()
                .setColor('00ff00')

            await interaction.update({ embeds: [embed], components: [] });


        } else {

            const embed = new EmbedBuilder()
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTitle(`**${targetChannelName}  controller has been successfully edited**`)
                .setDescription('It is enough to perform the same operations to change the controller')
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp()
                .setColor('00ff00')

            await interaction.update({ embeds: [embed], components: [] });
        }

        config[targetChannelId] = selectedChannelId;

        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

        if (targetChannelId === 'laddersHostedChannelId') {
            laddersHostedChannelIdG = selectedChannelId;
        }
        if (targetChannelId === 'ticketChannelId') {
            ticketChannelIdG = selectedChannelId;
        }
        if (targetChannelId === 'zoneWarsChannelId') {
            zoneWarsChannelIdG = selectedChannelId;
        }
        if (targetChannelId === 'AdminChannelId') {
            AdminChannelIdG = selectedChannelId;
        }


        console.log(`${targetChannelId} successfully updated.`);


    }
});


function readScores() {
    if (!fs.existsSync(scoresPath)) {
        return { "usersData": [] };
    }
    const data = fs.readFileSync(scoresPath);
    return JSON.parse(data);
}

function writeScores(data) {
    fs.writeFileSync(scoresPath, JSON.stringify(data, null, 2));
}

const channelIds = ["laddersHosted", "ticketLogs", "zoneWarsHoste"];

function updateScore(userId, channelKey) {
    const data = readScores();
    let userIndex = data.usersData.findIndex(user => user.userId === userId);
    const today = new Date().toISOString().slice(0, 10);


    if (userIndex === -1) {
        const newUser = {
            userId: userId,
            joined: today,
            warnedAndBreak: {
                warned: false,
                warnedTimes: 0,
                break: false,
                reason: "",
                breakDays: {}
            },
            channels: {}
        };
        channelIds.forEach(id => {
            newUser.channels[id] = {
                scores: { removedScores: 0 },
                boards: { total: 0, last7Days: 0, last14Days: 0 }
            };
        });
        data.usersData.push(newUser);
        userIndex = data.usersData.length - 1;
    }

    const user = data.usersData[userIndex];

    channelIds.forEach(id => {
        if (!user.channels[id].scores[today]) {
            user.channels[id].scores[today] = 0;
        }
    });

    user.channels[channelKey].scores[today] += 1;

    writeScores(data);
}

async function updateScoresPeriodically() {
    setInterval(async () => {

        const data = readScores();
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date();


        const guild = client.guilds.cache.get(GuildIDG);

        for (const user of data.usersData) {


            if (user.warnedAndBreak.warned) {
                try {
                    const member = await guild.members.fetch(user.userId);
                    const hasWarnedRole = member.roles.cache.some(role => role.name === "warned");


                    if (!hasWarnedRole) {
                        user.warnedAndBreak.warned = false;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (user.warnedAndBreak.break) {
                try {
                    const member = await guild.members.fetch(user.userId);
                    const hasBreakRole = member.roles.cache.some(role => role.name === "break");

                    if (!hasBreakRole) {
                        user.warnedAndBreak.break = false;
                        user.warnedAndBreak.breakDays = {};
                        user.warnedAndBreak.reason = "";
                    }
                } catch (error) {
                    continue;
                }
            }


            const breakDayKeys = Object.keys(user.warnedAndBreak.breakDays);
            const latestBreakDay = breakDayKeys[breakDayKeys.length - 1];

            if (latestBreakDay) {
                const latestBreakDateTime = new Date(latestBreakDay.replace(" ", "T"));
                if (now > latestBreakDateTime) {
                    user.warnedAndBreak.breakDays = {};
                    user.warnedAndBreak.reason = "";
                    user.warnedAndBreak.break = false;

                    if (guild) {
                        try {
                            const member = await guild.members.fetch(user.userId);
                            const breakRole = guild.roles.cache.find(role => role.name === "break");
                            if (breakRole && member.roles.cache.has(breakRole.id)) {
                                await member.roles.remove(breakRole);
                                console.log(`Removed 'break' role from user ${user.userId} in guild ${GuildIDG}.`);
                            }
                        } catch (error) {
                            console.error(`Error removing 'break' role from user ${user.userId}: ${error}`);
                        }
                    }

                }
            }
        }

        data.usersData.forEach(user => {
            Object.keys(user.channels).forEach(channelKey => {
                const channelScores = user.channels[channelKey].scores;

                if (!channelScores[today]) {
                    channelScores[today] = 0;
                }

                let removedScores = channelScores.removedScores || 0;
                const datesToRemove = [];

                Object.keys(channelScores).forEach(date => {
                    if (date !== 'removedScores') {
                        const dateDiff = Math.floor((new Date(today) - new Date(date)) / (1000 * 60 * 60 * 24));
                        if (dateDiff >= 15) {
                            removedScores += channelScores[date];
                            datesToRemove.push(date);
                        }
                    }
                });

                datesToRemove.forEach(date => {
                    delete channelScores[date];
                });

                channelScores.removedScores = removedScores;

                const scoresWithoutRemoved = Object.keys(channelScores).reduce((acc, date) => {
                    if (date !== 'removedScores') acc[date] = channelScores[date];
                    return acc;
                }, {});
                const last7DaysScores = Object.keys(scoresWithoutRemoved).slice(-7).reduce((sum, date) => sum + channelScores[date], 0);
                const last14DaysScores = Object.keys(scoresWithoutRemoved).slice(-14).reduce((sum, date) => sum + channelScores[date], 0);
                const totalScore = Object.values(scoresWithoutRemoved).reduce((sum, score) => sum + score, 0) + removedScores;

                user.channels[channelKey].boards = {
                    total: totalScore,
                    last7Days: last7DaysScores,
                    last14Days: last14DaysScores
                };
            });
        });

        writeScores(data);
    }, (5 * 1000));
}


client.on('guildMemberUpdate', (oldMember, newMember) => {


    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const hasStaffRole = newRoles.has(staffRoleG);

    if (hasStaffRole) {

        const userId = newMember.id;
        const data = readScores();

        let userData = data.usersData.find(u => u.userId === userId);

        if (userData) {
        } else {
            let today = new Date().toISOString().slice(0, 10);

            data.usersData.push({
                userId: userId,
                joined: today,
                warnedAndBreak: {
                    warned: false,
                    warnedTimes: 0,
                    break: false,
                    reason: "",
                    breakDays: {}
                },
                channels: channelIds.reduce((obj, channelId) => {
                    obj[channelId] = {
                        scores: { removedScores: 0 },
                        boards: { total: 0, last7Days: 0, last14Days: 0 }
                    };
                    return obj;
                }, {})
            });

            writeScores(data);
        }
    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'my-profile') {


        const userId = interaction.user.id;
        const data = readScores();

        let userData = data.usersData.find(u => u.userId === userId);

        if (userData) {
            sendUserStats(interaction.user.id, interaction);
        } else {

            const today = new Date().toISOString().slice(0, 10);

            data.usersData.push({
                userId: userId,
                joined: today,
                warnedAndBreak: {
                    warned: false,
                    warnedTimes: 0,
                    break: false,
                    reason: "",
                    breakDays: {}
                },
                channels: channelIds.reduce((obj, channelId) => {
                    obj[channelId] = {
                        scores: { removedScores: 0 },
                        boards: { total: 0, last7Days: 0, last14Days: 0 }
                    };
                    return obj;
                }, {})
            });

            writeScores(data);
            sendUserStats(interaction.user.id, interaction);
        }

    }

    if (interaction.commandName === 'profile') {

        const user = interaction.options.getUser('user');
        const userId = user.id;

        const data = readScores();

        let userData = data.usersData.find(u => u.userId === userId);

        if (userData) {
            sendUserStats(userId, interaction);
        } else {

            const today = new Date().toISOString().slice(0, 10);

            data.usersData.push({
                userId: userId,
                joined: today,
                warnedAndBreak: {
                    warned: false,
                    warnedTimes: 0,
                    break: false,
                    reason: "",
                    breakDays: {}
                },
                channels: channelIds.reduce((obj, channelId) => {
                    obj[channelId] = {
                        scores: { removedScores: 0 },
                        boards: { total: 0, last7Days: 0, last14Days: 0 }
                    };
                    return obj;
                }, {})
            });

            writeScores(data);
            sendUserStats(userId, interaction);

        }
    }

    async function sendUserStats(targetID, interaction) {
        const data = readScores();
        const user = data.usersData.find(u => u.userId === targetID);
        const userDC = client.users.cache.get(targetID);

        if (!user) {
            return;
        }

        let lastBreakDate


        if (Object.keys(user.warnedAndBreak.breakDays).length !== 0) {

            lastBreakDate = Object.keys(user.warnedAndBreak.breakDays).pop();
            console.log(`Last break date for user ${user.userId}: ${lastBreakDate}`);
        } else {
            lastBreakDate = '---'
        }


        const embed = new EmbedBuilder()
            .setThumbnail(userDC.displayAvatarURL())
            .setColor('#0099ff')
            .setTitle(`Statistics for ${userDC.globalName}`)
            .setDescription(`Joined:  **${user.joined}**\nWarned:  ${user.warnedAndBreak.warned ? '**Yes**' : '**No**'}  ( **${user.warnedAndBreak.warnedTimes}** Times )\nOn break:  ${user.warnedAndBreak.break ? '**Yes**' : '**No**'}, Ends: **${lastBreakDate}**`)

        Object.keys(user.channels).forEach(channelKey => {
            const channel = user.channels[channelKey];
            let channelTitle = '';
            switch (channelKey) {
                case 'laddersHosted':
                    channelTitle = 'Games Hosted';
                    break;
                case 'ticketLogs':
                    channelTitle = 'Tickets Managed';
                    break;
                case 'zoneWarsHoste':
                    channelTitle = 'Zonewars Hosted';
                    break;
                default:
                    channelTitle = channelKey;
            }
            embed.addFields(
                { name: '\n', value: '\n' },
                { name: `**${channelTitle}**`, value: `Past 7 Days: ${channel.boards.last7Days}\nPast 14 Days: ${channel.boards.last14Days}\nAll Time: ${channel.boards.total}`, inline: false },
                { name: '\n', value: '\n' }
            );
        });


        interaction.reply({ embeds: [embed] })

    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'break-request') {


        const userID = interaction.user.id;
        const data = readScores();
        const user = data.usersData.find(u => u.userId === userID);

        const username = interaction.user.globalName


        if (user && user.warnedAndBreak.break) {

            const warningEmbed = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`You are already on a break`)
                .setTimestamp()


            await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
            return;
        }

        const dayAmount = interaction.options.getInteger('day')
        const reason = interaction.options.getString('reason')

        const targetChannel = client.channels.cache.get(AdminChannelIdG);

        const successEmbed = new EmbedBuilder()
            .setColor('00ff00')
            .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`Your request is successful`)
            .setDescription('Your request has been sent to the admin channel. \nA message will be sent to you when your request is answered')
            .setFields({ name: '- Info -', value: `The reason: ${reason}\nThe requested day: ${dayAmount}` })
            .setTimestamp()

        interaction.reply({ embeds: [successEmbed], ephemeral: true })

        const embed = new EmbedBuilder()
            .setColor('Gold')
            .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`${interaction.user.globalName}'s request for a break`)
            .setDescription(`The reason: ${reason}\nThe requested day: ${dayAmount}`)

        let acceptButton = new ButtonBuilder()
            .setCustomId('acceptButton')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        let rejectButton = new ButtonBuilder()
            .setCustomId('rejectButton')
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        let buttonRow = new ActionRowBuilder().addComponents([acceptButton, rejectButton])



        if (targetChannel) {
            targetChannel.send({ embeds: [embed], components: [buttonRow] })
                .then((message) => {
                    const filter = (interaction) => interaction.customId === 'acceptButton' || interaction.customId === 'rejectButton';
                    const collector = targetChannel.createMessageComponentCollector({ filter });

                    collector.on('collect', async (interaction) => {
                        if (interaction.customId === 'acceptButton' || interaction.customId === 'rejectButton') {
                            if (interaction.message.id === message.id) {

                                if (interaction.customId === 'acceptButton') {


                                    const futureDateTime = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + dayAmount, new Date().getUTCHours(), new Date().getUTCMinutes()));
                                    const lastday = `${futureDateTime.toISOString().slice(0, 10)} ${futureDateTime.toISOString().slice(11, 16)}`;

                                    setBreak(userID, lastday, reason)


                                    const embed = new EmbedBuilder()
                                        .setColor('00ff00')
                                        .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                                        .setTitle(`${username}'s request for a break successful`)
                                        .setDescription(`<@${userID}> is on a ${dayAmount}-day break, Ends: **${lastday}**\nRequest was accepted by <@${interaction.user.id}>`)
                                        .setTimestamp()

                                    message.delete().catch(console.error);
                                    interaction.reply({ embeds: [embed], ephemeral: false })

                                    let roleName = 'break';

                                    let role = interaction.guild.roles.cache.find(r => r.name === roleName);
                                    let targetId = userID

                                    if (role) {

                                    } else {

                                        try {
                                            role = await interaction.guild.roles.create({
                                                name: roleName,
                                                color: "#ff1493",
                                                permissions: []
                                            });
                                        } catch (error) {
                                            console.error(`An error occurred while creating the role: ${error}`);
                                            return;
                                        }
                                    }

                                    let member = await interaction.guild.members.fetch(targetId);
                                    if (member) {
                                        await member.roles.add(role);

                                        const today = new Date().toISOString().slice(0, 10);

                                        const scoresData = readScores();
                                        const userIndex = scoresData.usersData.findIndex(user => user.userId === member.id);
                                        if (userIndex !== -1) {
                                            // scoresData.usersData[userIndex].warnedAndBreak.break = true;
                                            // scoresData.usersData[userIndex].warnedAndBreak.breakDays[lastday] = true;
                                            // writeScores(scoresData)
                                        } else {
                                            scoresData.usersData.push({
                                                userId: member.id,
                                                joined: today,
                                                warnedAndBreak: {
                                                    warned: false,
                                                    warnedTimes: 0,
                                                    break: true,
                                                    reason: "",
                                                    breakDays: {}
                                                },
                                                channels: channelIds.reduce((obj, channelId) => {
                                                    obj[channelId] = {
                                                        scores: { removedScores: 0 },
                                                        boards: { total: 0, last7Days: 0, last14Days: 0 }
                                                    };
                                                    return obj;
                                                }, {})
                                            });
                                        }
                                    }


                                    const user = client.users.cache.get(userID);

                                    const messageEmbed = new EmbedBuilder()
                                        .setColor('00ff00')
                                        .setTitle('**Admin has accepted your request!**')
                                        .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                                        .setDescription(`You are on a ${dayAmount}-day break, Ends: **${lastday}**`)
                                        .addFields({ name: '\n', value: '\n' })
                                        .setFooter({ text: 'If you think there is a mistake, please write to admin' })
                                        .setTimestamp()

                                    try {
                                        await user.send({ embeds: [messageEmbed] });
                                    } catch (error) {
                                        console.error('An error occurred while sending a direct message:', error);
                                    }

                                } else if (interaction.customId === 'rejectButton') {

                                    const embed = new EmbedBuilder()
                                        .setColor('ee2c2c')
                                        .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                                        .setTitle(`${username}'s request has been successfully rejected.`)
                                        .setDescription(`Request was rejected by <@${interaction.user.id}>`)
                                        .setTimestamp()

                                    message.delete().catch(console.error);
                                    interaction.reply({ embeds: [embed], ephemeral: false })

                                    const user = client.users.cache.get(userID);

                                    const messageEmbed = new EmbedBuilder()
                                        .setColor('ee2c2c')
                                        .setTitle('**Admin has rejected your request!**')
                                        .setAuthor({ name: 'Staff Bot', iconURL: client.user.displayAvatarURL() })
                                        .addFields({ name: '\n', value: '\n' })
                                        .setFooter({ text: 'If you think there is a mistake, please write to admin' })
                                        .setTimestamp()

                                    try {
                                        await user.send({ embeds: [messageEmbed] });
                                    } catch (error) {
                                    }

                                }
                            }
                        }
                    });
                });
        } else {
        }

    }
})


function setBreak(userId, lastday, reason = "") {
    const data = readScores();
    let user = data.usersData.find(u => u.userId === userId);

    if (!user) {
        user = {
            userId: userId,
            joined: new Date().toISOString().slice(0, 10),
            warnedAndBreak: {
                warned: false,
                warnedTimes: 0,
                break: false,
                reason: "",
                breakDays: {}
            },

        };

        user.channels['laddersHosted'] = { scores: { removedScores: 0 }, boards: { total: 0, last7Days: 0, last14Days: 0 } };
        user.channels['ticketLogs'] = { scores: { removedScores: 0 }, boards: { total: 0, last7Days: 0, last14Days: 0 } };
        user.channels['zoneWarsHoste'] = { scores: { removedScores: 0 }, boards: { total: 0, last7Days: 0, last14Days: 0 } };

        data.usersData.push(user);
    }


    user.warnedAndBreak.break = true;
    user.warnedAndBreak.reason = reason;
    user.warnedAndBreak.breakDays[lastday] = true;

    writeScores(data);
}

client.login(token);