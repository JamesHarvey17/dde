/**
 * Created by Fry on 8/6/17.
 */

Phrase = class Phrase{
    constructor({notes="",
                time=0, //in beats. used only for start time of first note if initializing notes from a string
                dur=null,   //in beats, null means compute dur from time and end of last note
                                 //this is the "logical dur" of the whole phrase,
                                 // ie 2 bars or 4 bars (8 or 16 respectively)
                                 //ignoring pickup notes and ignroing some rest at the end.
                                 //used for "concatenating phrases where you might have "picu notes"
                                 //before the logical 0 of the phrase. Those pickup notes
                                 //play during the time of the previous bar, and would have negative
                                 // start times.
                velocity=Phrase.default_velocity,
                channel=Phrase.default_channel, //null means leave the channel alone in tne note,
                              // presumably you're calling this with something like
                              // new Phrase ({channel:null, notes: [new note({channel:1 ...})
                              //where we've got channels in the indivdual notes,
                              //and they might be different channles in each note.
                seconds_per_beat=Phrase.default_seconds_per_beat
                } = {}){
        this.time             = time
        this.velocity         = velocity
        this.seconds_per_beat = seconds_per_beat
        if((arguments.length == 1) && (typeof(arguments[0]) == "string")){
           this.notes = arguments[0]
           if (this.channel == null) { this.channel = 1 }
           else { (this.channel = channel) } //always the default
        }
        else {
            this.notes   = notes
            this.channel = channel
        }
        if (typeof(this.notes) == "string") { this.fill_in_notes_from_string(this.notes) }
        if (dur === null) {
            if(this.notes.length == 0) { this.dur = 0 }
            else { this.dur = last(this.notes).time + last(this.notes).dur }
        } //in beats
        else { this.dur = dur }
    } //end of Phrase constructor

    fill_in_notes_from_string(notes_string){
        let time_of_next_note = this.time //in beats
        const array_of_note_strings = trim_all(notes_string).split(" ")
        this.notes = []
        for (let note_string of array_of_note_strings) {
            note_string = note_string.trim()
            if (note_string == "") {} //happens if user puts 2 spaces between notes. skip it
            else {
                //var note = new Note(note_string)
                let [dur_string, base_pitch_index] = Note.extract_dur_string(note_string)
                let dur
                if(dur_string == "")               { dur = 1 }
                else if (dur_string.includes("/")) { dur = eval(dur_string) }
                else                               { dur = parseFloat(dur_string) }
                while(true) {
                    let [pitch_class, octave_index] = Note.extract_pitch_class(note_string, base_pitch_index)
                    //next_octave_index only used when parsing notes for a phrase that might be a chord.
                    let [octave_string, next_base_pitch_index] = Note.extract_octave_string(note_string, octave_index)
                    let pitch_class_and_octave = pitch_class + octave_string
                    let pitch_num = Note.pitch_name_to_number(pitch_class_and_octave)
                    let note = new Note()
                    if (this.channel) { note.channel = this.channel } //1 through 16 or "all"
                    note.time     = time_of_next_note
                    note.dur = dur
                    note.pitch    = pitch_num
                    note.velocity = this.velocity
                    this.notes.push(note)
                    if (next_base_pitch_index){ base_pitch_index = next_base_pitch_index }
                    else { break; }
                }
                time_of_next_note += last(this.notes).dur
            }
        }
    }

    remove_rests(){
        let notes_copy = []
        for(let n of this.notes) {
            if(!n.is_rest()) { notes_copy.push(n.copy()) }
        }
        let result = this.copy_except_notes()
        result.notes = notes_copy
        return result
    }
    //this is used in Instruction.control.play to decide when playing a phrase,
    //how long from the start of the instruction should it be until the instruction ends
    //and the next instruction should be run.
    dur_in_seconds()      { return this.dur * this.seconds_per_beat }
    dur_in_ms()           { return Math.round(this.dur_in_seconds() * 1000) }
    seconds_to_beats(secs){ return secs / this.seconds_per_beat }

    ///////////BELOW HERE SAME METHODS FOR NOTE and PHRASE
    start(){
        for(let note of this.notes){ note.start(this.seconds_per_beat) }
        return this
    }

    copy(){
        let notes_copy = []
        for(let n of this.notes) { notes_copy.push(n.copy()) }
        let result = this.copy_except_notes()
        result.notes = notes_copy
        return result
    }
    //not defined for note
    copy_except_notes(){
        return new Phrase({ notes:    this.notes,
            time:     this.time,
            dur: this.dur,
            velocity: this.velocity,
            channel:  this.channel,
            seconds_per_beat: this.seconds_per_beat})
    }

    /*concat(...args){
        let result = this.copy()
        let new_notes = result.notes
        let orig_spb = result.seconds_per_beat
        let prev_phrase_spb = 1
        let prev_phrase_end_time_in_beats = 0 //even if the orig phrase has pickup notes.
        for (var n_or_p of args){
            let cur_phrase_spb = n_or_p.seconds_per_beat
            let cur_phrase_start_time_beats = Note.convert_beats(prev_phrase_end_time_in_beats, prev_phrase_spb, cur_phrase_spb)
            n_or_p = n_or_p.copy()
            if(n_or_p instanceof Note){
                var n = n_or_p
                var time_in_seconds = n.time * n.seconds_per_beat
                var time_in_beats_of_result = time_in_seconds / result.seconds_per_beat
                n.time = result.dur + time_in_beats_of_result
                n.dur = n_or_p.dur_in_seconds() / result.seconds_per_beat
                n.seconds_per_beat = result.seconds_per_beat
                new_notes.push(n)
                result.dur += result.seconds_to_beats(n.dur_in_seconds())
            }
            else if(n_or_p instanceof Phrase){
                for (var n of n_or_p.notes) {
                    var time_in_seconds = n.time * n.seconds_per_beat
                    var time_in_beats_of_result = time_in_seconds / result.seconds_per_beat
                    n.time = result.dur + time_in_beats_of_result
                    n.dur = n.dur_in_seconds() / result.seconds_per_beat
                    n.seconds_per_beat = result.seconds_per_beat
                    new_notes.push(n)
                }
                var new_p_dur_in_beats_of_result = n_or_p.dur_in_seconds() / result.seconds_per_beat
                result.dur += new_p_dur_in_beats_of_result
            }
        }
        return result
    }*/
    concat(...args){
        let result = this.copy()
        let new_notes                     = result.notes
        let orig_spb               = result.seconds_per_beat
        let prev_phrase_end_time_in_beats = this.dur //always in orig beats
        for (var n_or_p of args){
            n_or_p = n_or_p.copy()
            if(n_or_p instanceof Note){
                let n = n_or_p
                let cur_note_spb  = 1
                let cur_note_time_in_orig_beats = Note.convert_beats(n.time, 1, orig_spb) //just in case n.time != 0
                n.time = prev_phrase_end_time_in_beats + cur_note_time_in_orig_beats
                n.dur = Note.convert_beats(n.dur, 1, orig_spb)
                new_notes.push(n)
                prev_phrase_end_time_in_beats = Note.convert_beats(n.time + n.dur, 1, orig_spb)
                result.dur += n.time + n.dur
            }
            else if(n_or_p instanceof Phrase){ //a given phrase might have notes of different spb
                let phr = n_or_p
                for (var n of phr.notes) {
                    let orig_beats_time_for_n = Note.convert_beats(n.time, phr.seconds_per_beat, orig_spb)
                    n.time = prev_phrase_end_time_in_beats + orig_beats_time_for_n
                    n.dur =  Note.convert_beats(n.dur, phr.seconds_per_beat, orig_spb)
                    new_notes.push(n)
                }
                result.dur += Note.convert_beats(phr.dur, phr.seconds_per_beat, orig_spb)
                prev_phrase_end_time_in_beats = result.dur
            }
        }
        return result
    }
   /* merge(...args){
        var result = this.copy()
        var new_notes = result.notes
        var orig_spb = result.seconds_per_beat
        var longest_dur = result.dur
        for (var n_or_p of args){
            n_or_p = n_or_p.copy()
            if(n_or_p instanceof Note){
                var n = n_or_p
                var time_in_seconds = n.time * n.seconds_per_beat
                var time_in_beats_of_result = time_in_seconds / result.seconds_per_beat
                n.time = time_in_beats_of_result
                n.dur = n_or_p.dur_in_seconds() / result.seconds_per_beat
                n.seconds_per_beat = result.seconds_per_beat
                new_notes.push(n)
                var new_dur_in_beats_of_result = result.seconds_to_beats(n.dur_in_seconds())
                longest_dur = Math.max(longest_dur, new_dur_in_beats_of_result)
            }
            else if(n_or_p instanceof Phrase){
                for (var n of n_or_p.notes) {
                    var time_in_seconds = n.time * n.seconds_per_beat
                    var time_in_beats_of_result = time_in_seconds / result.seconds_per_beat
                    n.time = time_in_beats_of_result
                    n.dur = n.dur_in_seconds() / result.seconds_per_beat
                    n.seconds_per_beat = result.seconds_per_beat
                    new_notes.push(n)
                }
                var new_dur_in_beats_of_result = n_or_p.dur_in_seconds() / result.seconds_per_beat
                longest_dur = Math.max(longest_dur, new_dur_in_beats_of_result)
            }
        }
        result.dur = longest_dur
        return result
    }*/
    merge(...args){
        let result = this.copy()
        let new_notes = result.notes
        let orig_spb  = result.seconds_per_beat
        for (var n_or_p of args){
            n_or_p = n_or_p.copy()
            if(n_or_p instanceof Note){
                let n = n_or_p
                let cur_note_spb  = 1
                let cur_note_time_in_orig_beats = Note.convert_beats(n.time, 1, orig_spb) //just in case n.time != 0
                n.time = cur_note_time_in_orig_beats
                n.dur = Note.convert_beats(n.dur, 1, orig_spb)
                new_notes.push(n)
                result.dur = Math.max(result.dur, n.dur)
            }
            else if(n_or_p instanceof Phrase){ //a given phrase might have notes of different spb
                let phr = n_or_p
                for (var n of phr.notes) {
                    let orig_beats_time_for_n = Note.convert_beats(n.time, phr.seconds_per_beat, orig_spb)
                    n.time = orig_beats_time_for_n
                    n.dur =  Note.convert_beats(n.dur, phr.seconds_per_beat, orig_spb)
                    new_notes.push(n)
                }
                result.dur = Math.max(result.dur, Note.convert_beats(phr.dur, phr.seconds_per_beat, orig_spb))
            }
        }
        return result
    }
    transpose(interval_or_array, key="chromatic"){
       if (typeof(interval_or_array) == "number") { interval_or_array = [interval_or_array]}
       const new_notes = []
       for(let note of this.notes){
           if (note.is_rest()) { new_notes.push(note.copy()) }
           else {
               for(let interval of interval_or_array){
                   new_notes.push(note.transpose(interval, key))
               }
           }
       }
       let result = this.copy_except_notes()
       result.notes = new_notes
       return result
    }

    //virtual prop: octave
    set_property(prop_name, new_value){
        let new_phrase = this.copy_except_notes()
        let new_notes = []
        for(let n of this.notes) { new_notes.push(n.set_property(prop_name, new_value)) }
        new_phrase.notes = new_notes
        return new_phrase
    }
    //virtual prop: octave
    increment_property(prop_name, increment, min=-2, max=127){
        let new_phrase = this.copy_except_notes()
        let new_notes = []
        for(let n of this.notes) { new_notes.push(n.increment_property(prop_name, increment, min, max)) }
        new_phrase.notes = new_notes
        return new_phrase
    }
    //virtual prop: time_and_dur
    multiply_property(prop_name, factor, min=-2, max=127){
        let new_phrase = this.copy_except_notes()
        let new_notes = []
        for(let n of this.notes) { new_notes.push(n.multiply_property(prop_name, factor, min, max)) }
        new_phrase.notes = new_notes
        return new_phrase
    }

}
Phrase.default_channel  = 1
Phrase.default_velocity = 0.5
Phrase.default_seconds_per_beat = 1




