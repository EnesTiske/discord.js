const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

let { logChannelId, clientId, guildId, token } = require('./config/config.json');
const { rejects } = require('assert');

const configPath = 'src/config/config.json';

const commands = [

    new SlashCommandBuilder()
        .setName('set-log-channel')
        .setDescription('Set the log channel for the server')
        .setDefaultMemberPermissions(0)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set as the log channel')
                .addChannelTypes(0)
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('modal')
        .setDescription('Send a modal message')
        .setDefaultMemberPermissions(0),

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
    console.log(`Logged in as ${client.user.tag}`);
});

const successEmbed = new EmbedBuilder()
    .setDescription('Operation successful!')
    .setColor('Green');


client.on('interactionCreate', async interaction => {

    if (interaction.isModalSubmit() && interaction.customId === 'nickname-request-modal') {

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        const nickname = interaction.fields.getTextInputValue('nickname-request-input');

        const channel = await client.channels.fetch(logChannelId);

        const embed = new EmbedBuilder()
            .setTitle('Nickname Request')
            .setDescription(`<@${interaction.user.id}> requested nickname: ${nickname}`)
            .setColor('Blue');

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accept-nickname')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('reject-nickname')
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

        const message = await channel.send({ embeds: [embed], components: [actionRow] });

        const collector = message.createMessageComponentCollector({});

        collector.on('collect', async button => {

            if (button.customId === 'accept-nickname') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.setNickname(nickname);



                const newActionRow = new ActionRowBuilder();
                message.components[0].components.forEach((component) => {
                    newActionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(component.customId)
                            .setLabel(component.label)
                            .setStyle(component.style)
                            .setDisabled(true)
                    );
                });

                await message.edit({ components: [newActionRow] });

                const embed = new EmbedBuilder()
                    .setDescription('Nickname accepted!')
                    .setColor('Green');

                const acceptEmbed = new EmbedBuilder()
                    .setDescription('Your nickname request has been accepted!')
                    .setColor('Green');

                await interaction.user.send({ embeds: [acceptEmbed] });

                button.reply({ embeds: [embed], ephemeral: true });
            }

            if (button.customId === 'reject-nickname') {

                const newActionRow = new ActionRowBuilder();
                message.components[0].components.forEach((component) => {
                    newActionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(component.customId)
                            .setLabel(component.label)
                            .setStyle(component.style)
                            .setDisabled(true)
                    );
                });

                await message.edit({ components: [newActionRow] });

                const embed = new EmbedBuilder()
                    .setDescription('Nickname rejected!')
                    .setColor('Red');

                const rejectEmbed = new EmbedBuilder()
                    .setDescription('Your nickname request has been rejected!')
                    .setColor('Red');

                await interaction.user.send({ embeds: [rejectEmbed] });

                button.reply({ embeds: [embed], ephemeral: true });
            }
        });
    }

    if (interaction.isCommand() && interaction.commandName === 'set-log-channel') {

        const logChannel = interaction.options.getChannel('channel');

        logChannelId = logChannel.id;

        fs.writeFileSync((configPath), JSON.stringify({ logChannelId, clientId, guildId, token }), (err) => { if (err) console.error(err) });

        const embed = new EmbedBuilder()
            .setDescription(`Log channel set to <#${logChannelId}>`)
            .setColor('Green');

        interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.isCommand() && interaction.commandName === 'modal') {

        const embed = new EmbedBuilder()
            .setTitle('Nickname Request')
            .setDescription('Click the button below to request a nickname')
            .setColor('Blue');

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('nickname-request')
                    .setLabel('Nickname Request')
                    .setStyle(ButtonStyle.Success)
            );



        interaction.reply({ embeds: [successEmbed], ephemeral: true });

        const message = await interaction.channel.send({ embeds: [embed], components: [actionRow] });

        const collector = message.createMessageComponentCollector({});

        collector.on('collect', async button => {

            if (button.customId === 'nickname-request') {

                const modal = new ModalBuilder()
                    .setCustomId('nickname-request-modal')
                    .setTitle('Enter your requested nickname');

                const nicknameInput = new TextInputBuilder()
                    .setCustomId('nickname-request-input')
                    .setLabel("Nickname ")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)

                const firstActionRow = new ActionRowBuilder().addComponents(nicknameInput);

                modal.addComponents(firstActionRow)
                button.showModal(modal);
            }
        });
    }
});

client.login(token);

process.on('uncaughtException', error => {
    console.error('Error: ', error);

});