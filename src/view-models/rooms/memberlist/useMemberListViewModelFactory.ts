/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { useContext, useMemo } from "react";
import { RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import useMemberListViewModel, { IMemberListViewModel } from "./useMemberListViewModel";
import { SDKContext } from "../../../contexts/SDKContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { MemberService } from "../../../services/rooms/memberlist/MemberSerice";

export function useMemberListViewModelFactory(roomId: string): IMemberListViewModel {
    const cli = useMatrixClientContext();
    const room = cli.getRoom(roomId);
    const sdkContext = useContext(SDKContext);
    const canInviteToState = useEventEmitterState(
        room || undefined,
        RoomStateEvent.Update,
        () => !!room && canInviteTo(room),
    );
    const memberService = useMemo(
        () => new MemberService(roomId, cli, sdkContext.memberListStore),
        [roomId, cli, sdkContext.memberListStore],
    );
    return useMemberListViewModel(canInviteToState, room?.isSpaceRoom() ?? false, memberService);
}
