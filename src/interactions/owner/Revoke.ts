import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User } from 'discord.js';

export default class Pass extends BotInteraction {
    get name() {
        return 'revoke';
    }

    get description() {
        return 'Revokes a users ability to use administrative features for a Feature (i.e. rejecting reports)';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get featureOptions() {
        const assignOptions: any = {
            'Reports': 'reports',
            'Assign': 'assign',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('feature').setDescription('Feature').addChoices(
                ...this.featureOptions
            ).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const feature: string = interaction.options.getString('feature', true);
        const user: User = interaction.options.getUser('user', true);

        const { colours } = this.client.util;

        const overrides = await this.client.database.get('overrides');

        const errorEmbed = new EmbedBuilder()
            .setTitle('Something went wrong!')
            .setColor(colours.discord.red)
            .setDescription('The database was not configured properly.');
        if (!overrides) return await interaction.editReply({ embeds: [errorEmbed] });

        if (!overrides[feature]) {
            overrides[feature] = []
        } else {
            if (overrides[feature].includes(user.id.toString())) {
                overrides[feature] = overrides[feature].filter((item: string) => item !== user.id.toString())
            } else {
                const replyEmbed = new EmbedBuilder()
                    .setTitle('Something went wrong!')
                    .setColor(colours.discord.red)
                    .setDescription(`<@${user.id}> does not have permission to use the **${feature}** feature.`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }

        await this.client.database.set('overrides', overrides);

        const replyEmbed = new EmbedBuilder()
            .setTitle('Permissions successfully revoked!')
            .setColor(colours.discord.green)
            .setDescription(`<@${user.id}> has successfully had their permissions to use the **${feature}** feature revoked.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}