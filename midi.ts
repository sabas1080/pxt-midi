enum MidiCommand {
    //% block="tune request"
    TuneRequest = 0xf6,
    //% block="timing clock"
    TimingClock = 0xf8,
    //% block="start"
    Start = 0xfa,
    //% block="continue"
    Continue = 0xfb,
    //% block="stop"
    Stop = 0xfc,
    //% block="active sensing"
    ActiveSensing = 0xfe,
    //% block="reset"
    Reset = 0xff
}

enum MidiChannelMode {
    //% block="all sound off"
    AllSoundOff = 120 << 8 | 0,
    //% block="reset all controllers"
    ResetAllControllers = 121 << 8 | 0,
    //% block="local control off"
    LocalControlOff = 122 << 8 | 0,
    //% block="local control on"
    LocalControlOn = 122 << 8 | 127,
    //% block="all notes off"
    AllNotesOff = 123 << 8 | 0,
    //% block="omni mode off"
    OmniModeOff = 124 << 8 | 0,
    //% block="omni mode on"
    OmniModeOn = 125 << 8 | 0,
    //% block="mono mode off"
    MonoModeOff = 126 << 8 | 0,
    //% block="mono mode on"
    MonoModeOn = 126 << 8 | 1,
    //% block="poly mode on"
    PolyModeOn = 127 << 8 | 0
}

/**
 * Blocks to simulate MIDI instruments.
 */
//% weight=85 icon="\uf001" color="#5ea9dd"
namespace midi {
    /**
     * Transport needs to be set prior to using MIDI APIs
     */
    let inputTransport: (data: Buffer) => void;

    /**
     * Sets the transport mechanism to send MIDI commands
     * @param transport current transport
     */
    //% advanced=true
    export function setInputTransport(transport: (data: Buffer) => void) {
        inputTransport = transport;
    }

    /**
     * Sends a MIDI message
     * @param data 1,2 or 3 numbers
     */
    //% advanced=true
    export function sendMessage(data: number[]) {
        if (!inputTransport) return;

        // TODO: create buffer from number[]
        const buf = pins.createBuffer(data.length);
        for (let i = 0; i < data.length; ++i)
            buf.setNumber(NumberFormat.UInt8LE, i, data[i])
        inputTransport(buf);
    }

    /**
     * Send MIDI messages via serial
     */
    //% blockId=midi_serial_transport block="midi use serial"
    //% advanced=true
    export function useSerial() {
        function send(data: Buffer): void {
            // waiting for beta
            //const buf = pins.createBuffer(data.length);
            //for (let i = 0; i < data.length; ++i)
            //    buf[i] = data[i];
            // serial.writeBuffer(buf);
            serial.writeString("midi:")
            for (let i = 0; i < data.length; ++i) {
                if (i > 0) serial.writeString(",");
                serial.writeNumber(data[i]);
            }
            serial.writeLine("");
        }
        setInputTransport(send)
    }

    let inputs: MidiInput[];
    /**
     * Gets the MIDI input device for a given channel. If not transport is setup, uses serial transport.
     * @param channel the selected input channel, eg: 0
     */
    //% blockId="midi_input" block="midi input channel %channel"
    //% subcategory="Channels" weight=90 channel.min=0 channel.max=15
    export function inputChannel(channel: number): MidiInput {
        if (!inputTransport) useSerial();

        channel = Math.max(0, Math.min(15, channel));

        if (!inputs) inputs = [];
        let i = inputs[channel];
        if (!i) i = inputs[channel] = new MidiInput(channel);

        return i;
    }

    /**
     * A Input MIDI device
     */
    //%
    export class MidiInput {
        channel: number;
        velocity: number;

        constructor(channel: number) {
            this.channel = channel;
            this.velocity = 0x7f;
        }

        /**
         * Plays a note for the given duration and adds a small pause
         * @param key key to play between 0 and 127
         * @param duration duration of play
         */
        //% blockId=midi_note block="%this|note %key|duration %duration=device_beat"
        //% blockGap=8 weight=82
        //% subcategory="Channels"
        note(key: number, duration: number): void {
            if (duration > 0) {
                this.noteOn(key);
                basic.pause(duration);
            }
            this.noteOff(key);
            basic.pause(6);
        }

        /**
         * Starts playing a note
         * @param key the note to play
         */
        //% blockId=midi_note_on block="%this|note on %key"
        //% key.min=0 key.max=127 velocity.min=0 velocity.max=127
        //% blockGap=8 weight=81
        //% subcategory="Channels"
        noteOn(key: number, velocity = 0): void {
            if (key < 0 || key > 0x7F) return;

            sendMessage([0x90 | this.channel, key, velocity || this.velocity]);
        }

        /**
         * Stops playing a note
         * @param note the note to stop
         */
        //% blockId=midi_note_off block="%this|note off %key"
        //% key.min=0 key.max=127 velocity.min=0 velocity.max=127
        //% blockGap=8 weight=80
        //% subcategory="Channels"
        noteOff(key: number, velocity = 0): void {
            if (key < 0 || key > 0x7F) return;

            sendMessage([0x80 | this.channel, key, velocity || this.velocity]);
        }

        /**
         * Sets the instrument on this input channel
         * @param instrument the instrument to select
         */
        //% blockId=midi_set_instrument block="%this|set instrument %instrument=midi_instrument"
        //% instrument.min=0 instrument.max=16
        //% weight=70
        //% subcategory="Channels"
        setInstrument(instrument: MidiInstrument): void {
            instrument -= 1;
            if (instrument < 0 || instrument > 0x7f) return;

            sendMessage([0xc0 | this.channel, instrument]);
        }

        /**
         * Sets the velocity
         * @param velocity velocity of the instrument
         */
        //% blockId=midi_set_velocity block="%this|set velocity %velocity"
        //% velocity.min=0 velocity.max=127
        //% blockGap=8 weight=79
        //% subcategory="Channels"
        setVelocity(velocity: number): void {
            this.velocity = velocity & 0x7F;
        }

        /**
         * Sets the pitch on the channel
         * @param amount current bend, eg: 512
         */
        //% blockGap=8 blockId=midi_set_pitch_bend block="%this|set pitch bend %amount"
        //% amount.min=0 amount.max=1023 weight=78
        //% subcategory="Channels"
        pitchBend(amount: number) {
            amount *= 16;
            amount = amount & 0x3fff;
            sendMessage([0xe0 | this.channel, amount & 0x7f, (amount >> 7) & 0x7f]);
        }

        /**
         * Sends a MIDI command
         * @param cmd the command to send
         */
        //% blockId=midi_command block="%this|command %cmd"
        //% blockGap=8
        //% subcategory="Channels"
        command(cmd: MidiCommand) {
            sendMessage([cmd | this.channel]);
        }

        /**
         * This message sent when the patch number changes.
         * @param program the new program value
         */
        //% blockId=midi_program_change block="%this|program change to %program"
        //% blockGap=8
        //% subcategory="Channels"
        //% program.min=0 program.max=127
        programChange(program: number) {
            sendMessage([0xc0 | this.channel, program & 0xf]);
        }

        /**
         * Channel Pressure (After-touch). This message is most often sent by pressing down on the key after it "bottoms out".
         * This message is different from polyphonic after-touch. Use this message to send the single greatest pressure value (of all the current depressed keys).
         * @param pressure the pressure value
         */
        //% blockId=midi_after_touch block="%this|after touch %pressure"
        //% blockGap=8
        //% subcategory="Channels"
        //% pressure.min=0 pressure.max=127
        aftertouch(pressure: number) {
            sendMessage([0xd0 | this.channel, pressure & 0xf]);
        }

        /**
         * Polyphonic Key Pressure (Aftertouch). This message is most often sent by pressing down on the key after it "bottoms out".
         * @param key the note to play
         * @param pressure the pressure
         */
        //% blockId=midi_polyphonic_after_touch block="%this|polyphonic after touch %key %pressure"
        //% blockGap=8
        //% subcategory="Channels"
        //% key.min=0 key.max=127
        //% pressure.min=0 pressure.max=127
        polyphonicAftertouch(key: number, pressure: number) {
            sendMessage([0xa0 | this.channel, key & 0xf, pressure & 0xf]);
        }

        /**
         * Control Change. This message is sent when a controller value changes. Controllers include devices such as pedals and levers.
         * Controller numbers 120-127 are reserved as "Channel Mode Messages".
         * @param controller the controller number
         * @param value the value
         */
        //% blockId=midi_control_change block="%this|control change %key to %pressure"
        //% blockGap=8
        //% subcategory="Channels"
        //% fn.min=0 fn.max=119
        //% value.min=0 value.max=127
        controlChange(fn: number, value: number) {
            sendMessage([0xb0 | this.channel, fn & 0xf, value & 0xf]);
        }

        /**
         * Channel mode control Change.
         * @param mode the channel mode change
         */
        //% blockId=midi_polyphonic_after_touch block="%this|mode %mode"
        //% blockGap=8
        //% subcategory="Channels"
        channelMode(mode: MidiChannelMode) {
            sendMessage([0xb0 | this.channel, (mode >> 8) & 0xf, mode & 0xf]);
        }
    }

    /**
     * Plays a tone on channel 0
     * @param frequency frequency of the note that will be mapped to a key
     * @param duration duration of the note
     */
    //% blockId=midi_play_tone block="midi play|tone %frequency=device_note|for %duration=device_beat" blockGap=8
    //% weight=91
    export function playTone(frequency: number, duration: number): void {
        inputChannel(0).note(frequencyToKey(frequency), duration);
    }

    /**
     * Applies a pitch bend effect to channel ``0``.
     * @param bend the amount of bending to be applied on channel 0, eg: 512
     */
    //% blockId=midi_pitch_bend block="midi pitch bend %bend"
    //% bend.min=0 bend.max=1023
    export function pitchBend(bend: number): void {
        inputChannel(0).pitchBend(bend);
    }

    const notes = [8, 9, 9, 10, 10, 11, 12, 12, 13, 14, 15, 15, 16, 17, 18, 19, 21, 22, 23, 24, 26, 28, 29, 31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73, 78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208, 220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397, 1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040, 7459, 7902, 8372, 8870, 9397, 9956, 10548, 11175, 11840, 12544];
    /**
     * Maps a frequency to a note key
     * @param frequency
     */
    //% blockId=midi_frequency_to_key block="key at %frequency=device_note" useEnumVal=1
    //% advanced=true
    export function frequencyToKey(frequency: number): number {
        let left = 0, right = 0x7f, mid = 69;

        while (right - left > 1) {
            const midf = notes[mid];
            if (frequency == midf)
                return mid;
            else if (frequency < midf) {
                right = mid;
            } else {
                left = mid;
            }
            mid = (left + right) / 2;
        }
        // imprecise match
        return frequency - notes[left] < notes[right] - frequency
            ? left : right;
    }

    /**
     * Plays a drum sound on channel 10
     * @param key index of the sound
     */
    //% blockId=midi_drum block="midi play drum %key=midi_drum_sound"
    //% weight=90
    export function playDrum(key: number): void {
        inputChannel(10).noteOn(key);
    }

    /**
     * Selects a drum sound
     * @param drumSound the type of sound
     */
    //% blockId=midi_drum_sound block="%sound"
    //% shim=TD_ID weight=5 advanced=true
    export function drumSound(sound: DrumSound): number {
        return sound;
    }
}