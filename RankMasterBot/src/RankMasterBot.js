const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST, Routes } = require("discord.js");
const fs = require('fs');
const dataPath = 'src/data/data.json';
const shopPath = 'src/data/shop.json';
const cron = require('node-cron');
const { PermissionFlagsBits } = require('discord-api-types/v10');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { clientId, guildId, token, WeeklyBalance } = require('./config/config.json');

const commands = [

    new SlashCommandBuilder()
        .setName('currency-add')
        .setDescription('currency-add')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select a user')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Enter the balance you want to add')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('add-shop')
        .setDescription('add-shop')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('name')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('fee')
                .setDescription('fee')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('remove-shop')
        .setDescription('Removes an item from the shop')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of the item to remove')
                .setAutocomplete(true)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('currency')
        .setDescription('Displays the user\'s current balance.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select a user')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Select an item from the shop')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to purchase')
                .setRequired(true)
                .setAutocomplete(true)),



    new SlashCommandBuilder()
        .setName('newprice')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('Select an item from the shop')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to purchase')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option =>
            option
                .setName('fee')
                .setDescription('fee')
                .setRequired(true)
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



let guild



client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'newprice') {
        const focusedOption = interaction.options.getFocused(true);
        const shopData = loadShop();

        const choices = shopData.map(item => ({
            name: `${item.name} -- Fee: ${item.fee}`,
            value: item.name
        }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);

        await interaction.respond(filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    }

    if (interaction.commandName === 'shop') {
        const focusedOption = interaction.options.getFocused(true);
        const shopData = loadShop();

        const choices = shopData.map(item => ({
            name: `${item.name} -- Fee: ${item.fee}`,
            value: item.name
        }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);

        await interaction.respond(filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    }

    if (interaction.commandName === 'remove-shop') {
        const focusedOption = interaction.options.getFocused(true);
        const shopData = loadShop();

        const choices = shopData.map(item => ({
            name: `${item.name} -- Fee: ${item.fee}`,
            value: item.name
        }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);

        await interaction.respond(filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    }
});



client.on('ready', async () => {
    guild = client.guilds.cache.get(guildId);
    if (!guild) return console.log("Sunucu bulunamadı!");
    await guild.members.fetch();
});



client.on('messageCreate', message => {
    if (message.author.bot) return;
    increaseXP(message.author.id)

})


client.on('interactionCreate', async interaction => {
    if (interaction.customId === 'deleteMessage') {

        interaction.message.delete()
            .then(() => interaction.reply({ content: 'Message deleted.', ephemeral: true }))
            .catch(error => console.error(`Error deleting message: ${error}`));
    }


    if (!interaction.isChatInputCommand()) return;


    if (interaction.commandName === 'currency') {
        const user = interaction.options.getUser('user');
        const userId = user.id;
        const userData = loadData(); 

        const userBalance = userData.users[userId] || { totalBalance: 0, remainingBalance: 0 };

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`${user.globalName}'s Balance`)
            .addFields(
                { name: 'Total Balance', value: `${userBalance.totalBalance}`, inline: true },
                { name: 'Remaining Balance', value: `${userBalance.remainingBalance}`, inline: true },
                { name: "\n", value: "\n" }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }



    if (interaction.commandName === 'remove-shop') {
        const name = interaction.options.getString('name');
        let shopData = loadShop();

        const index = shopData.findIndex(item => item.name === name);

        if (index === -1) {
            const warnEmbed = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`Item couldn't be removed to the shop!`)
                .setDescription(`Item with name '${name}' not found in the shop!`)
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp();

            await interaction.reply({ embeds: [warnEmbed], ephemeral: true });
            return;
        }

        shopData.splice(index, 1);
        saveShop(shopData);

        const successfullyEmbed = new EmbedBuilder()
            .setColor('00ff00')
            .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`The item has been successfully removed to the shop`)
            .setDescription(`Item with name '${name}' has been removed from the shop.`)
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp();

        await interaction.reply({ embeds: [successfullyEmbed], ephemeral: true });
    }



    if (interaction.commandName === 'add-shop') {
        const name = interaction.options.getString('name');
        const fee = interaction.options.getInteger('fee');

        const shopData = loadShop();

        const itemExists = shopData.some(item => item.name === name);
        if (itemExists) {
            const warnEmbed = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`Item couldn't be added to the shop!`)
                .setDescription(`Item with name **'${name}'** already exists in the shop!`)
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp();

            await interaction.reply({ embeds: [warnEmbed], ephemeral: true });
            return;
        }

        shopData.push({ name, fee });
        saveShop(shopData);

        const successfullyEmbed = new EmbedBuilder()
            .setColor('00ff00')
            .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`The item has been successfully added to the shop`)
            .setDescription(`Item with name **'${name}'** and fee **${fee}** has been added to the shop.`)
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp();

        await interaction.reply({ embeds: [successfullyEmbed], ephemeral: true });
    }



    if (interaction.commandName === 'newprice') {
        const name = interaction.options.getString('item');
        const newFee = interaction.options.getInteger('fee');

        let shopData = loadShop();

        const itemIndex = shopData.findIndex(item => item.name === name);
        if (itemIndex === -1) {
            await interaction.reply({ content: `Item with name '${name}' not found in the shop.`, ephemeral: true });
        } else {
            shopData[itemIndex].fee = newFee;

            saveShop(shopData);

            const successfullyEmbed = new EmbedBuilder()
                .setColor('00ff00')
                .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`Price of '${name}' updated to ${newFee}.`)
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp();

            await interaction.reply({ embeds: [successfullyEmbed], ephemeral: true });
        }
    }



    if (interaction.commandName === 'shop') {
        const selectedItem = interaction.options.getString('item');
        const userId = interaction.user.id;

        const shopData = loadShop();

        const item = shopData.find(i => i.name === selectedItem);
        if (!item) {
            await interaction.reply({ content: "Selected item not found in the shop.", ephemeral: true });
            return;
        }

        const fee = item.fee;

        subtractBalance(userId, fee, interaction, selectedItem)
    }



    if (interaction.commandName === 'currency-add') {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount')
        updateBalance(user.id, amount, interaction, user)

    }
})



function loadShop() {
    if (!fs.existsSync(shopPath)) {
        fs.writeFileSync(shopPath, JSON.stringify({ shopData: [] }, null, 4));
    }
    const fileContent = JSON.parse(fs.readFileSync(shopPath, 'utf-8'));
    return fileContent.shopData;
}


function saveShop(shopData) {
    fs.writeFileSync(shopPath, JSON.stringify({ shopData }, null, 4));
}


function loadData() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}


function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}


function ensureUser(data, userId) {
    if (!data.users[userId]) {
        data.users[userId] = { id: userId, remainingBalance: 0, totalBalance: 0, xp: 0 };
    }
    return data;
}


function increaseXP(userId) {
    let data = loadData();
    data = ensureUser(data, userId);
    data.users[userId].xp += 1;
    saveData(data);
}


function updateBalance(userId, amount, interaction, user) {
    let data = loadData();
    data = ensureUser(data, userId);
    data.users[userId].remainingBalance += amount;
    data.users[userId].totalBalance += amount;
    saveData(data);


    const embed = new EmbedBuilder()
        .setColor('00ff00')
        .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
        .setTitle(`${user.username}'s balance information has been updated`)
        .setDescription(`Remaining Balance: ${data.users[userId].remainingBalance}\nTotal Balance: ${data.users[userId].totalBalance}`)
        .addFields({ name: "\n", value: "\n" })
        .setTimestamp()

    interaction.reply({ embeds: [embed], ephemeral: true })
}


async function subtractBalance(userId, fee, interaction, shopChoices) {
    let data = loadData();
    data = ensureUser(data, userId);
    let control = data.users[userId].remainingBalance >= fee

    if (control) {
        try {
            data.users[userId].remainingBalance -= fee;
            saveData(data);

            const adminEmbed = new EmbedBuilder()
                .setColor('Purple')
                .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`${interaction.user.globalName}'s purchase information`)
                .setDescription(`Item: **${shopChoices}**\nFee: **${fee}**\nRemaining Balance: **${data.users[userId].remainingBalance}**\nTotal Balance: **${data.users[userId].totalBalance}**\nUser: <@${userId}>`)
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp();

            const deleteButton = new ButtonBuilder()
                .setCustomId('deleteMessage')
                .setLabel('Delete Message')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(deleteButton);

            guild.members.cache.forEach(member => {
                if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                    member.send({
                        embeds: [adminEmbed],
                        components: [row]
                    })
                        .then(() => console.log(`Message sent to ${member.user.tag}`))
                        .catch(error => console.log(`Failed to send message to ${member.user.tag}: ${error}`));
                }
            });

            const userEmbed = new EmbedBuilder()
                .setColor('00ff00')
                .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
                .setTitle(`${interaction.user.globalName}'s purchase information`)
                .setDescription(`Item: **${shopChoices}**\nFee: **${fee}**\nRemaining Balance: **${data.users[userId].remainingBalance}**\nTotal Balance: **${data.users[userId].totalBalance}**`)
                .addFields({ name: "\n", value: "\n" })
                .setTimestamp();

            await interaction.reply({ embeds: [userEmbed], ephemeral: true });
        } catch (error) {
            console.error(`An error occurred: ${error}`);
            interaction.reply({ content: 'There was an error processing your request.', ephemeral: true });
        }
    } else {
        const userEmbed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: 'RankMasterBot', iconURL: client.user.displayAvatarURL() })
            .setTitle(`${interaction.user.globalName}'s purchase information`)
            .setDescription(`Purchase failed. Your balance is insufficient.\nRemaining Balance: **${data.users[userId].remainingBalance}**`)
            .addFields({ name: "\n", value: "\n" })
            .setTimestamp();

        await interaction.reply({ embeds: [userEmbed], ephemeral: true });
    }

}


function addWeeklyBalance() {
    let data = loadData();

    for (const userId in data.users) {
        data.users[userId].remainingBalance += WeeklyBalance;
        data.users[userId].totalBalance += WeeklyBalance;
    }

    saveData(data);
    console.log(`Weekly balance added to all users at ${new Date().toISOString()}`);
}

cron.schedule('0 0 * * 1', () => {
    addWeeklyBalance();
}, {
    scheduled: true,
    timezone: "America/New_York"
});

client.login(token);