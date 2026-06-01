import React from 'react';
import RoleManager from '../../Role/RoleManager';

export default function GuildRolesSection({ guild }) {
    return <RoleManager guildId={guild?.id} variant="settings" />;
}
