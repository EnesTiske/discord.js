const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { clientId, guildId, token } = require('./config/config.json');
let { newRoleID, month1RoleID, month2RoleID, month3RoleID, month4RoleID, month5RoleID, month6RoleID, month7RoleID, month8RoleID, month9RoleID, month10RoleID, month11RoleID, year1RoleID, year2RoleID, year3RoleID, year4RoleID, year5RoleID, year6RoleID, year7RoleID, year8RoleID, year9RoleID, year10RoleID } = require('./config/roleID.json');

const commands = [].map(command => command);

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
        console.error('Failed to reload commands:', error);
    }
}
command();

client.on('ready', async () => {
    try {
        const guild = await client.guilds.fetch(guildId);
        const members = await guild.members.fetch();

        async function checkRoles() {
            members.forEach(async member => {
                try {
                    const joinedTimestamp = member.joinedTimestamp;
                    const now = Date.now();
                    const diff = now - joinedTimestamp;
                    const diffDays = diff / (1000 * 60 * 60 * 24);

                    if (diffDays <= 30) {
                        await updateMemberRole(member, newRoleID);
                    } else if (diffDays > 30 && diffDays <= 365) {
                        const monthIndex = Math.ceil(diffDays / 30) - 2;
                        const roleIDs = [month1RoleID, month2RoleID, month3RoleID, month4RoleID, month5RoleID, month6RoleID, month7RoleID, month8RoleID, month9RoleID, month10RoleID, month11RoleID];
                        await updateMemberRole(member, roleIDs[monthIndex], roleIDs[Math.max(0, monthIndex - 1)]);
                    } else {
                        const yearIndex = Math.ceil(diffDays / 365) - 2;
                        const roleIDs = [year1RoleID, year2RoleID, year3RoleID, year4RoleID, year5RoleID, year6RoleID, year7RoleID, year8RoleID, year9RoleID, year10RoleID];
                        await updateMemberRole(member, roleIDs[Math.min(yearIndex, roleIDs.length - 1)], roleIDs[Math.max(0, yearIndex - 1)]);
                    }
                } catch (error) {
                    console.error('Failed to update member roles:', error);
                }
            });
        }

        async function updateMemberRole(member, newRoleID, previousRoleID = null) {
            try {
                if (previousRoleID && member.roles.cache.has(previousRoleID)) {
                    await member.roles.remove(previousRoleID);
                }
                if (!member.roles.cache.has(newRoleID)) {
                    await member.roles.add(newRoleID);
                }
            } catch (error) {
                console.error(`Failed to update roles for ${member.user.username}:`, error);
            }
        }

        console.log(`Logged in as ${client.user.tag}!`);

        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        setInterval(checkRoles, millisecondsPerDay);
        checkRoles();
    } catch (error) {
        console.error('Failed on client ready:', error);
    }
});

client.on('guildMemberAdd', member => {
    try {
        member.roles.add(newRoleID)
            .then(() => console.log(`Role ${newRoleID} has been assigned to ${member.user.username}`))
            .catch(console.error);
    } catch (error) {
        console.error('Failed on guildMemberAdd:', error);
    }
});

client.login(token);