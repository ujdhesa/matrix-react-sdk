/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ChangeEvent } from "react";
import { act, render, screen } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import ProfileSettings from "../../../../src/components/views/settings/ProfileSettings";
import { stubClient } from "../../../test-utils";
import { ToastContext, ToastRack } from "../../../../src/contexts/ToastContext";
import { OwnProfileStore } from "../../../../src/stores/OwnProfileStore";

interface MockedAvatarSettingProps {
    removeAvatar: () => void;
    onChange: (file: File) => void;
}

let removeAvatarFn: () => void;
let changeAvatarFn: (file: File) => void;

jest.mock(
    "../../../../src/components/views/settings/AvatarSetting",
    () =>
        (({ removeAvatar, onChange }) => {
            removeAvatarFn = removeAvatar;
            changeAvatarFn = onChange;
            return <div>Mocked AvatarSetting</div>;
        }) as React.FC<MockedAvatarSettingProps>,
);

let editInPlaceOnChange: (e: ChangeEvent<HTMLInputElement>) => void;
let editInPlaceOnSave: () => void;
let editInPlaceOnCancel: () => void;

interface MockedEditInPlaceProps {
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
    value: string;
}

jest.mock("@vector-im/compound-web", () => ({
    EditInPlace: (({ onChange, onSave, onCancel, value }) => {
        editInPlaceOnChange = onChange;
        editInPlaceOnSave = onSave;
        editInPlaceOnCancel = onCancel;
        return <div>Mocked EditInPlace: {value}</div>;
    }) as React.FC<MockedEditInPlaceProps>,
}));

describe("ProfileSettings", () => {
    let client: MatrixClient;
    let toastRack: Partial<ToastRack>;

    beforeEach(() => {
        client = stubClient();
        toastRack = {
            displayToast: jest.fn().mockReturnValue(jest.fn()),
        };
    });

    it("removes avatar", async () => {
        render(
            <ToastContext.Provider value={toastRack}>
                <ProfileSettings />
            </ToastContext.Provider>,
        );

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(removeAvatarFn).toBeDefined();

        act(() => {
            removeAvatarFn();
        });

        expect(client.setAvatarUrl).toHaveBeenCalledWith("");
    });

    it("changes avatar", async () => {
        render(
            <ToastContext.Provider value={toastRack}>
                <ProfileSettings />
            </ToastContext.Provider>,
        );

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(changeAvatarFn).toBeDefined();

        const returnedMxcUri = "mxc://example.org/my-avatar";
        mocked(client).uploadContent.mockResolvedValue({ content_uri: returnedMxcUri });

        const fileSentinel = {};
        await act(async () => {
            await changeAvatarFn(fileSentinel as File);
        });

        expect(client.uploadContent).toHaveBeenCalledWith(fileSentinel);
        expect(client.setAvatarUrl).toHaveBeenCalledWith(returnedMxcUri);
    });

    it("changes display name", async () => {
        jest.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

        render(
            <ToastContext.Provider value={toastRack}>
                <ProfileSettings />
            </ToastContext.Provider>,
        );

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
        expect(editInPlaceOnSave).toBeDefined();

        act(() => {
            editInPlaceOnChange({
                target: { value: "The Value" } as HTMLInputElement,
            } as ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
            await editInPlaceOnSave();
        });

        expect(client.setDisplayName).toHaveBeenCalledWith("The Value");
    });

    it("resets on cancel", async () => {
        jest.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

        render(
            <ToastContext.Provider value={toastRack}>
                <ProfileSettings />
            </ToastContext.Provider>,
        );

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
        expect(editInPlaceOnChange).toBeDefined();
        expect(editInPlaceOnCancel).toBeDefined();

        act(() => {
            editInPlaceOnChange({
                target: { value: "Alicia Zattic" } as HTMLInputElement,
            } as ChangeEvent<HTMLInputElement>);
        });

        expect(await screen.findByText("Mocked EditInPlace: Alicia Zattic")).toBeInTheDocument();

        act(() => {
            editInPlaceOnCancel();
        });

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
    });
});
