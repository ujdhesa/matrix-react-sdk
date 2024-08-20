/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";
import { Client } from "../../pages/client";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { Bot } from "../../pages/bot";

/**
 * Set up for pinned message tests.
 */
export const test = base.extend<{
    room1Name?: string;
    room1: { name: string; roomId: string };
    util: Helpers;
}>({
    displayName: "Alice",
    botCreateOpts: { displayName: "Other User" },

    room1Name: "Room 1",
    room1: async ({ room1Name: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await use({ name, roomId });
    },

    util: async ({ page, app, bot }, use) => {
        await use(new Helpers(page, app, bot));
    },
});

export class Helpers {
    constructor(
        private page: Page,
        private app: ElementAppPage,
        private bot: Bot,
    ) {}

    /**
     * Sends messages into given room as a bot
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    async receiveMessages(room: string | { name: string }, messages: string[]) {
        await this.sendMessageAsClient(this.bot, room, messages);
    }

    /**
     * Use the supplied client to send messages or perform actions as specified by
     * the supplied {@link Message} items.
     */
    private async sendMessageAsClient(cli: Client, roomName: string | { name: string }, messages: string[]) {
        const room = await this.findRoomByName(typeof roomName === "string" ? roomName : roomName.name);
        const roomId = await room.evaluate((room) => room.roomId);

        for (const message of messages) {
            await cli.sendMessage(roomId, { body: message, msgtype: "m.text" });

            // TODO: without this wait, some tests that send lots of messages flake
            // from time to time. I (andyb) have done some investigation, but it
            // needs more work to figure out. The messages do arrive over sync, but
            // they never appear in the timeline, and they never fire a
            // Room.timeline event. I think this only happens with events that refer
            // to other events (e.g. replies), so it might be caused by the
            // referring event arriving before the referred-to event.
            await this.page.waitForTimeout(100);
        }
    }

    /**
     * Find a room by its name
     * @param roomName
     * @private
     */
    private async findRoomByName(roomName: string) {
        return this.app.client.evaluateHandle((cli, roomName) => {
            return cli.getRooms().find((r) => r.name === roomName);
        }, roomName);
    }

    /**
     * Open the room with the supplied name.
     */
    async goTo(room: string | { name: string }) {
        await this.app.viewRoomByName(typeof room === "string" ? room : room.name);
    }

    /**
     * Pin the given message
     * @param message
     */
    async pinMessage(message: string) {
        const timelineMessage = this.page.locator(".mx_MTextBody", { hasText: message });
        await timelineMessage.click({ button: "right" });
        await this.page.getByRole("menuitem", { name: "Pin" }).click();
    }

    /**
     * Pin the given messages
     * @param messages
     */
    async pinMessages(messages: string[]) {
        for (const message of messages) {
            await this.pinMessage(message);
        }
    }

    /**
     * Open the room info panel
     */
    async openRoomInfo() {
        await this.page.getByRole("button", { name: "Room info" }).nth(1).click();
    }

    /**
     * Assert that the pinned count in the room info is correct
     * Open the room info and check the pinned count
     * @param count
     */
    async assertPinnedCountInRoomInfo(count: number) {
        await expect(this.page.getByRole("menuitem", { name: "Pinned messages" })).toHaveText(
            `Pinned messages${count}`,
        );
    }

    /**
     * Open the pinned messages list
     */
    async openPinnedMessagesList() {
        await this.page.getByRole("menuitem", { name: "Pinned messages" }).click();
    }

    /**
     * Return the right panel
     * @private
     */
    private getRightPanel() {
        return this.page.locator("#mx_RightPanel");
    }

    /**
     * Assert that the pinned message list contains the given messages
     * @param messages
     */
    async assertPinnedMessagesList(messages: string[]) {
        const rightPanel = this.getRightPanel();
        await expect(rightPanel.getByRole("heading", { name: "Pinned messages" })).toHaveText(
            `${messages.length} Pinned messages`,
        );
        await expect(rightPanel).toMatchScreenshot(`pinned-messages-list-messages-${messages.length}.png`);

        const list = rightPanel.getByRole("list");
        await expect(list.getByRole("listitem")).toHaveCount(messages.length);

        for (const message of messages) {
            await expect(list.getByText(message)).toBeVisible();
        }
    }

    /**
     * Assert that the pinned message list is empty
     */
    async assertEmptyPinnedMessagesList() {
        const rightPanel = this.getRightPanel();
        await expect(rightPanel).toMatchScreenshot(`pinned-messages-list-empty.png`);
    }

    /**
     * Open the unpin all dialog
     */
    async openUnpinAllDialog() {
        await this.openRoomInfo();
        await this.openPinnedMessagesList();
        await this.page.getByRole("button", { name: "Unpin all" }).click();
    }

    /**
     * Return the unpin all dialog
     */
    getUnpinAllDialog() {
        return this.page.locator(".mx_Dialog", { hasText: "Unpin all messages?" });
    }

    /**
     * Click on the Continue button of the unoin all dialog
     */
    async confirmUnpinAllDialog() {
        await this.getUnpinAllDialog().getByRole("button", { name: "Continue" }).click();
    }

    /**
     * Go back from the pinned messages list
     */
    async backPinnedMessagesList() {
        await this.page.locator("#mx_RightPanel").getByTestId("base-card-back-button").click();
    }

    /**
     * Open the contextual menu of a message in the pin message list and click on unpin
     * @param message
     */
    async unpinMessageFromMessageList(message: string) {
        const item = this.getRightPanel().getByRole("list").getByRole("listitem").filter({
            hasText: message,
        });

        await item.getByRole("button").click();
        await this.page.getByRole("menu", { name: "Open menu" }).getByRole("menuitem", { name: "Unpin" }).click();
    }
}

export { expect };