exports.makeFIXMsgCreator = function(){ return new FIXMsgCreator();}

function FIXMsgCreator(){
    this.description = "converts key/val map to fix string with correct checksum";
    
    this.outgoing = function(ctx, event){
        if(event.eventType !== "data"){
            ctx.next(event);
        }
        
        var msg = event.data;
        var stream = ctx.stream;
        
        var senderCompIDExtracted = msg[tags["TargetCompID"]];
        var targetCompIDExtracted = msg[tags["SenderCompID"]];

        delete msg[tags["BodyLength"]]; //bodylength
        delete msg[tags["CheckSum"]]; //checksum
        delete msg[tags["SendingTime"]]; //timestamp
        delete msg[tags["BeginString"]]; //fixversion
        delete msg[tags["TargetCompID"]]; //sendercompid
        delete msg[tags["SenderCompID"]]; //targetcompid
        delete msg[tags["MsgSeqNum"]]; //seqnum
        var headermsgarr = [];
        for (var f in Object.keys(headers)) {
            //if (headers.hasOwnProperty(f)) {
                var tag = headers[f];

                if (tag == "8" || tag == "9" || tag == "59" || tag == "52" || tag == "56" || tag == "49" || tag == "34") {
                    continue;
                }

                if (tag.charAt(tag.length - 1) != "?" && msg[tag] === undefined) { //If tag is required, but missing
                    logger.error("[ERROR] tag " + tag + " is required but missing in outgoing message: " + msg);
                    return;
                }

                if (msg[tag] !== undefined) {
                    headermsgarr.push(tag, "=", msg[tag], SOHCHAR);
                    delete msg[tag];
                }
            //}
        }

        var timestamp = new Date();
        headermsgarr.push("52=" , timestamp.getUTCFullYear() , timestamp.getUTCMonth() , timestamp.getUTCDay() , "-" , timestamp.getUTCHours() , ":" , timestamp.getUTCMinutes() , ":" , timestamp.getUTCSeconds() , "." , timestamp.getUTCMilliseconds() , SOHCHAR);
        headermsgarr.push("56=" , (senderCompIDExtracted || senderCompID) , SOHCHAR);
        headermsgarr.push("49=" , (targetCompIDExtracted || targetCompID) , SOHCHAR);
        headermsgarr.push("34=" , (outgoingSeqNum++) , SOHCHAR);

        var trailermsgarr = [];
        for (var f in Object.keys(trailers)) {
            //if (trailers.hasOwnProperty(f)) {
                var tag = trailers[f];

                if (tag == "10") {
                    continue;
                }

                if (tag.charAt(tag.length - 1) != "?" && msg[tag] === undefined) { //If tag is required, but missing
                    logger.error("[ERROR] tag " + tag + " is required but missing in outgoing message: " + msg);
                    return;
                }

                if (msg[tag] !== undefined) {
                    trailermsgarr.push(tag , "=" , msg[tag] , SOHCHAR);
                    delete msg[tag];
                }

            //}
        }

        var bodymsgarr = [];
        for (var tag in msg) {
            if (msg.hasOwnProperty(tag)) {
                bodymsgarr.push( tag , "=" , msg[tag] , SOHCHAR);
            }
        }

        var headermsg = headermsgarr.join("");
        var trailermsg = trailermsgarr.join("");
        var bodymsg = bodymsgarr.join("");
        
        var outmsgarr = [];
        outmsgarr.push( "8=" , fixVersion , SOHCHAR);
        outmsgarr.push( "9=" , (headermsg.length + bodymsg.length + trailermsg.length) , SOHCHAR);
        outmsgarr.push( headermsg);
        outmsgarr.push( bodymsg);
        outmsgarr.push( trailermsg);
        
        var outmsg = outmsgarr.join("");

        outmsg += "10=" + checksum(outmsg) + SOHCHAR;

        logger.info("FIX out:" + outmsg);
        timeOfLastOutgoing = new Date().getTime();

        //addOutMsg(targetCompID, outmsg);

        stream.write(outmsg);
    }
}

