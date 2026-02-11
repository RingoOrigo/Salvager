const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags, ButtonStyle, ApplicationIntegrationType, InteractionContextType, ActionRow } = require('discord.js');
const { crateCost } = require('../../config/config.json');
const db = require('../../utils/database.js');
const items = ['Ontos', 'Logos', 'Pneuma'];

async function displayShopMenu(interaction) {
    // Simply display the shop menu through a small embed with an action row.

    const buyButton = new ButtonBuilder()
        .setCustomId('cmd-crate')
        .setLabel(`Purchase Crate! (${crateCost} Ouros)`)
        .setStyle(ButtonStyle.Primary);
    const balanceButton = new ButtonBuilder()
        .setCustomId('cmd-balance')
        .setLabel('View Balance')
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(buyButton, balanceButton);

    const shopEmbed = new EmbedBuilder()
        .setTitle("Purchase Salvaged Crates")
        .setDescription("For a fee, you can purchase (and immediately open) a salvaged crate for a variety of rewards! Will you make your Ouros back, or will you find something even better?")
        .setTimestamp()
        .setFooter({
            text: `Disclaimer: Salvaged crates are rigged against you.`
        })
        .setColor('#8ca4aa');

    await interaction.reply({
        embeds: [shopEmbed],
        components: [row],
        flags: MessageFlags.Ephemeral
    })
}

function openCrate () {
    // The true logic for opening the crate
    const crates = db.prepare('SELECT * FROM LootboxTable').all();
    const totalWeight = crates.reduce((sum, crate) => sum + crate.Weight, 0);
    let roll = Math.random() * totalWeight;
    let finalCrate = null;
    let foundItem = null;

    for (const crate of crates) {
        if (roll < crate.Weight) {
            finalCrate = crate;
            break;
        }
        roll -= crate.Weight;
    }

    const earnings = Math.floor(Math.random() * (finalCrate.MaxValue - finalCrate.MinValue + 1) + finalCrate.MinValue);
    if (Math.random() * 100 < finalCrate.ItemWeight) {
        foundItem = finalCrate.Item;
    }

    if (foundItem == "Random") {
        foundItem = items[Math.floor(Math.random() * 3)];
    }

    return { crate: finalCrate, item: foundItem, earnings: earnings }

}

async function updateWithoutItem(interaction, lootboxEmbed, row, crateResult) {
    // Update the database differently, as no item was found.

    const updateData = db.prepare(`
                INSERT INTO Users (UserID, Balance)
                VALUES (?, ?)
                ON CONFLICT (UserID) DO UPDATE SET
                    Balance = Balance - Excluded.Balance
            `);

    updateData.run(interaction.user.id, (crateCost - crateResult.earnings));

    await interaction.reply({
        content: `**${interaction.user.displayName}** has opened a salvage crate!`,
        embeds: [lootboxEmbed],
        components: [row]
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crate')
        .setDescription('Spend your Ouros to open a salvaged crate.')
        .setContexts([
        InteractionContextType.Guild, 
        InteractionContextType.BotDM, 
        InteractionContextType.PrivateChannel
        ])
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ]),

        async execute (interaction) {
            // Immediately defer update to allow for processing times.

            if (!interaction.isButton() || interaction.customId == 'cmd-crate-view') {
                return await displayShopMenu(interaction);
            }

            let userRow = db.prepare('SELECT * FROM Users WHERE UserID = ?').get(interaction.user.id);
            if (!userRow) {
                // If the user doesn't exist, add them to the database.
                db.prepare(`INSERT OR IGNORE INTO users (UserID) VALUES (?)`).run(user.id);
                userRow = db.prepare(`SELECT * FROM users WHERE UserID = ?`).get(user.id);
            }

            let balance = userRow.Balance;
            if (balance < crateCost) {
                return await interaction.reply({
                    content: `You cannot afford a salvage crate. Come back when you have at least **${crateCost} Ouros**.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const crateResult = openCrate();
            const promptButton = new ButtonBuilder()
                .setCustomId('cmd-crate-view')
                .setLabel('Open Shop Menu!')
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(promptButton);

            const lootboxEmbed = new EmbedBuilder()
                .setTitle(`${crateResult.crate.Rarity} Crate`)
                .setColor(crateResult.crate.Colour)
                .addFields(
                    { name: '__Earnings__', value: `${crateResult.earnings} Ouros` },
                    { name: '__Salvaged Items__', value: `${crateResult.item != null ? `${crateResult.item} Core (1x)` : `No items`}` }
                )
                .setTimestamp();

            if (crateResult.item == null) {
                return updateWithoutItem(interaction, lootboxEmbed, row, crateResult);
            }

            const updateData = db.prepare(`
                INSERT INTO Users (UserID, Balance, ${crateResult.item})
                VALUES (?, ?, 1)
                ON CONFLICT (UserID) DO UPDATE SET
                    Balance = Balance - Excluded.Balance,
                    ${crateResult.item} = ${crateResult.item} + 1   
            `);

            updateData.run(interaction.user.id, (crateCost - crateResult.earnings));

            await interaction.reply({
                content: `**${interaction.user.displayName}** has opened a salvage crate!`,
                embeds: [lootboxEmbed],
                components: [row]
            });
        }
    }