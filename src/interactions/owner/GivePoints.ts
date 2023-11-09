import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User } from 'discord.js';
import { TrialParticipation } from '../../entity/TrialParticipation';
import { Trial } from '../../entity/Trial';
import { Reaper } from '../../entity/Reaper';
import { ReaperParticipation } from '../../entity/ReaperParticipation';

export default class GivePoints extends BotInteraction {
    get name() {
        return 'give-points';
    }

    get description() {
        return 'Gives leaderboard points for a team (i.e. trial participation)';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get featureOptions() {
        const assignOptions: any = {
            'Trial Team': 'trial',
            'Reaper': 'reaper',
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
            .addStringOption((option) => option.setName('team').setDescription('Team').addChoices(
                ...this.featureOptions
            ).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addIntegerOption((option) => option.setName('quantity').setDescription('Quantity of points').setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const team: string = interaction.options.getString('team', true);
        const user: User = interaction.options.getUser('user', true);
        const quantity: number = interaction.options.getInteger('quantity', true);

        const { dataSource } = this.client;
        const { colours } = this.client.util;

        if (team === 'trial') {
            const repository = dataSource.getRepository(Trial);
            let existingPlaceholder = await repository.findOne({
                where: {
                    host: 'Placeholder'
                }
            })
            if (!existingPlaceholder) {
                const placeholder = new Trial();
                placeholder.host = 'Placeholder';
                placeholder.link = 'Placeholder';
                placeholder.trialee = 'Placeholder';
                placeholder.role = 'Placeholder';
                existingPlaceholder = await repository.save(placeholder);
            }
            if (quantity > 0) {
                const newData: any = [...Array(quantity)].map((element) => ({ participant: user.id, role: 'Placeholder', trial: existingPlaceholder }));
                await dataSource
                    .createQueryBuilder()
                    .insert()
                    .into(TrialParticipation)
                    .values(newData)
                    .execute()
            }
            else if (quantity < 0) {
                const participationRepo = dataSource.getRepository(TrialParticipation);

                for(let i = 0; i < Math.abs(quantity); i++){
                    let participationToDelete = await participationRepo.findOne({
                        where: {
                            participant: user.id,
                        }
                    })
                    if (participationToDelete) {
                        console.log('Placeholder entry found.' + i);
                        // Delete the entry if it exists
                        await participationRepo.remove(participationToDelete);
                    
                        console.log('Entry deleted successfully.' + i);
                    } else {
                        console.log('Entry not found.' + i);
                    }
                }
            }
        }

        if (team === 'reaper') {
            const reaperRepo = dataSource.getRepository(Reaper);
            let existingPlaceholder = await reaperRepo.findOne({
                where: {
                    host: 'Placeholder'
                }
            })
            if (!existingPlaceholder) {
                const placeholder = new Reaper();
                placeholder.host = 'Placeholder';
                placeholder.link = 'Placeholder';
                placeholder.recipient = 'Placeholder';
                existingPlaceholder = await reaperRepo.save(placeholder);
            }
            if (quantity > 0) {
                const newData: any = [...Array(quantity)].map((element) => ({ participant: user.id, reaper: existingPlaceholder }));
                await dataSource
                    .createQueryBuilder()
                    .insert()
                    .into(ReaperParticipation)
                    .values(newData)
                    .execute()
            }
            else if (quantity < 0){
                const participationRepo = dataSource.getRepository(ReaperParticipation);

                for(let i = 0; i < Math.abs(quantity); i++){
                    let participationToDelete = await participationRepo.findOne({
                        where: {
                            participant: user.id,
                            // reaper: existingPlaceholder
                        }
                    })
                    if (participationToDelete) {
                        console.log('Placeholder entry found.' + i);
                        // Delete the entry if it exists
                        await participationRepo.remove(participationToDelete);
                    
                        console.log('Entry deleted successfully.' + i);
                    } else {
                        console.log('Entry not found.' + i);
                    }
                }
            }
        }

        const replyEmbed = new EmbedBuilder()
            .setTitle('Points successfully granted!')
            .setColor(colours.discord.green)
            .setDescription(`<@${user.id}> was successfully granted **${quantity}** points.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}