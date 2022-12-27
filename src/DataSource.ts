import "reflect-metadata"
import { DataSource } from "typeorm"
import { Override } from "./entity/Override"
import { Report } from "./entity/Report"
import { Trial } from "./entity/Trial"
import { TrialParticipation } from "./entity/TrialParticipation"

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: "db.sqlite",
    synchronize: true,
    logging: false,
    entities: [Override, Report, Trial, TrialParticipation],
})
