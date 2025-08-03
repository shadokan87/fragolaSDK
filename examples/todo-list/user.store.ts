import { nanoid } from "nanoid";
import { createStore } from "../../fragola/agent";

interface user {
    name: string,
    email: string,
    id: string,
}
export type UserStoreType = {user: user};
export const userStore = createStore<UserStoreType>({
    user: {
        id: nanoid(),
        name: "kol",
        email: "eclipse.toure@outlook.fr"
    }
});