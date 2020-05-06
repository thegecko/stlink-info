/**
 * Inspired by https://github.com/devanlai/webstlink
 */

const STLINK_GET_VERSION = 0xf1;
const STLINK_DEBUG_COMMAND = 0xf2;
const STLINK_DEBUG_APIV2_ENTER = 0x30;
const STLINK_DEBUG_ENTER_SWD = 0xa3;
const STLINK_DEBUG_READCOREID = 0x22;
const STLINK_DEBUG_EXIT = 0x21;

export class DeviceInfo {
    constructor(device) {
        this.device = device;
    }

    async getStlinkVersion() {
        try {
            await this.connect();
            let version = await this.transfer([STLINK_GET_VERSION, 0x80]);
            version = version.getUint16(0);
            const stlink = ((version >> 12) & 0x0f);
            const jtag = ((version >> 6) & 0x3f);
            return `V${stlink}J${jtag}`;
        } finally {
            await this.disconnect();
        }
    }

    async getCoreId() {
        try {
            await this.connect();
            await this.transfer([STLINK_DEBUG_COMMAND, STLINK_DEBUG_APIV2_ENTER, STLINK_DEBUG_ENTER_SWD]);
            let result = await this.transfer([STLINK_DEBUG_COMMAND, STLINK_DEBUG_READCOREID]);
            await this.write([STLINK_DEBUG_COMMAND, STLINK_DEBUG_EXIT]);

            result = result.getUint32(0, true);
            return result.toString(16).padStart(8, "0");;
        } finally {
            await this.disconnect();
        }
    }

    async connect() {
        await this.device.open();

        if (this.device.configuration !== 1) {
            await this.device.selectConfiguration(1);
        }

        const iface = this.device.configuration.interfaces[0];
        if (!iface.claimed) {
            await this.device.claimInterface(0);
        }

        if (iface.alternate === null || iface.alternate.alternateSetting !== 0) {
            await this.device.selectAlternateInterface(0, 0);
        }
    }

    async disconnect() {
        await this.device.close();
    }

    async transfer(command) {
        await this.write(command);
        const result = await this.device.transferIn(0x81 & 0x7f, 64);
        return result.data;
    }

    async write(command) {
        const buffer = new Uint8Array(16);
        command.forEach((v, i) => buffer[i] = v);

        await this.device.transferOut(0x01, buffer);
    }
}
