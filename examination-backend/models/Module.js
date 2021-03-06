const admin = require('firebase-admin');
const db = admin.firestore();

const Messages = require('../models/Messages');
const each = require("async/each");

/**
* Use to set results or update them
* */
module.exports.updateResults = function (result,callback) {
    let moduleCode = result.moduleCode;
    // Make sure there is a module code
    if(moduleCode){
        let docRef = db.collection('Modules').doc(moduleCode);
        // check whether user have rights to modify results and module exists
        docRef.get().then(doc => {
            if(doc.exists){
                let temp = doc.data();
                if (temp.admins.indexOf(result.userId) > -1) {
                    docRef.update({
                        resultAvailable: true,
                        lastEditedBy: result.userId,
                        results: result.results
                    });
                    callback(null, {success: true});
                }else {
                    callback('Permission denied', null);
                }
            } else {
                callback('No such module', null);
            }
        }).catch(err => {
            callback(err, null);
        });
        } else {
        callback('Error no module Code',null);
        }
};

module.exports.isModuleExists = function(moduleId, callback){
    if (moduleId){
        db.collection('Modules').doc(moduleId).get().then(snapShot => {
            if(snapShot.exists){
                callback(null, true);
            } else {
                callback(null, false);
            }
        }).catch(err => {
            callback(err, null);
        });
    } else {
        callback('ModuleId must be non-empty',null);
    }
   
}

/**
* Use to create module in the database
* module {
*   moduleCode:string,
*   admins:string[] // ids of everyone who can change the module data
*   registeredStudents:string[] // ids of all registered students
*   resultAvailable: boolean
*   results:object[] // (index,result) pair for students
* }
* */
module.exports.createModule = function (module, callback) {
    console.log(module.moduleCode)
    if(module.moduleCode){
        let docRef = db.collection('Modules').doc(module.moduleCode);
        docRef.get().then(snapShot => {
            if(snapShot.exists){
                callback('Module already exists', null);
            } else {
                docRef.set(module);
                callback(null, 'Module created successfully');
            }
        }).catch(err => {
            callback(err, null);
        });
    } else {
        callback('ModuleCode must be non empty',null);
    }
};

/**
 * Use to delete the record of a file from the database
 */
module.exports.deleteFileRecord = function(moduleId,fileName,callback){
    if(moduleId === null || fileName === null){
        return callback('Module ID and file name must be non empty', null);
    } else {
        const docRef = db.collection('Files').doc(moduleId);
        docRef.get()
        .then(snapshot => {
            let data = snapshot.data();
            fileList = data.fileList;
            let index = fileList.indexOf(fileName);
            fileList.splice(index,1);
            docRef.update(data);
            return callback(null, 'File remove successfully');
        })
        .catch(err => {
            console.log(err);
            callback(err, null);
        })
    }
}

/**
 * Use to record upload data to the database
 */
module.exports.recordUpload = function(moduleId, fileName, callback){
    if(moduleId === null || fileName === null){
        callback('moduleId and file name must be non empty', null);
    } else {
        const docRef = db.collection('Files').doc(moduleId);
        docRef.get()
        .then(snapshot => {
            fileList = [fileName];
            data = {
                fileList:fileList
            };
            if(snapshot.exists){
                // update the uploaded files
                let data = snapshot.data();
                fileList = data.fileList;
                fileList.push(fileName);
                docRef.update(data);
            } else {
                docRef.set(data)
            }
            
            callback(null, 'Database updated successfully');
        }).catch(err => {
            console.log(err);
            callback(err,null);
        });
    }  
}

/**
 * Use to get list of files uploaded for a given module
 */
module.exports.getFileList = function(moduleId, callback){
    if(moduleId === null){
        callback('ModuleId must be non empty', null)
    } else {
        db.collection('Files').doc(moduleId).get().then(snapshot => {
            fileList = []
            if(snapshot.exists){
                fileList = snapshot.data().fileList;
            }
            callback(null, fileList);
        }).catch(err => {
            callback(err, null);
        });
    }
}

/**
* Use to get module by module Id assuming doc id is same as module id
* */
module.exports.getModulebyId = function (id, callback) {
    db.collection('Modules').doc(id)
        .get()
        .then(snapshot => {
            if(snapshot.exists){
                callback(null, snapshot.data());
            } else {
                callback('Invalid module code', null);
            }
        }).catch(err => {
            callback(err, null);
        });
};

/**
* Use to get module ids of the module registered by a given id as a student
* */
module.exports.getRegisteredModules = function (userId, callback) {
    let registeredModules = [];
    db.collection('Modules')
        .get()
        .then(docs => {
            docs.forEach(doc => {
                let data = doc.data();
                // Make sure registered students is not undefined
                if(data.registeredStudents && data.registeredStudents.indexOf(userId) > -1){
                    registeredModules.push(data.moduleCode);
                }
            });
            callback(null, registeredModules);
        }).catch(err => {
            callback(err, null);
        });

};

/**
 * Use to get module ids of modules where the user id is registered as an admin
 */
module.exports.getAdminModules = function (userId, callback) {
    let adminModules = [];
    db.collection('Modules')
        .get()
        .then(docs => {
            docs.forEach(doc => {
                let data = doc.data();
                // Make sure registered students is not undefined
                if(data.admins && data.admins.indexOf(userId) > -1){
                    adminModules.push(data.moduleCode);
                }
            });
            callback(null, adminModules);
        }).catch(err => {
            callback(err, null);
        });
};

/**
 * Use to register for a given module
 * */
module.exports.registerToModule = function (userId,moduleId,callback) {
    if(userId && moduleId){
        let docRef = db.collection('Modules').doc(moduleId);
        docRef.get().then(snapShot =>{
            if(snapShot.exists){
                let registeredStudents = snapShot.data().registeredStudents;
                // make sure student haven't registered yet
                if(registeredStudents.indexOf(userId) > -1){
                    callback('Already registered', null);
                } else {
                    registeredStudents.push(userId);
                    docRef.update({
                        registeredStudents:registeredStudents
                    });
                    callback(null,true);
                }
            } else {
                callback('No such module', null);
            }
        }).catch(err => {
            callback(null, err);
        });
    } else {
        callback('userId and/or moduleId must be non empty',null);
    }
};

/**
 * Use to get a list of all the existing modules
 */
module.exports.getModuleList = function(callback){
    modules = []
    db.collection('Modules').get().then(docs=> {
        docs.forEach(doc => {
            modules.push(doc.data().moduleCode);
        });
        callback(null, modules);
    }).catch(err=>{
        callback(err, null);
    });
}

/**
 * Use to create a re-correction request
 * */
module.exports.requestReCorrection = function(userId,moduleId,callback){
    if(userId && moduleId){
        let docRef = db.collection('Modules').doc(moduleId);
        docRef.get().then(doc => {
            if(doc.exists){
                let admins = doc.data().admins;
                let requested = doc.data().reCorrectionRequested;
                // make sure results has been released for the module
                if(doc.data().resultAvailable){
                    // make sure student has registered to the module
                    if(doc.data().registeredStudents.indexOf(userId) > -1){
                        console.log(requested)
                        // make sure student haven't request reCorrection
                        if(requested === undefined || requested.indexOf(userId) < 0){
                            // add the student to the requested list
                            if(!requested){
                                requested = []
                            }
                            requested.push(userId);
                            docRef.update({
                                reCorrectionRequested:requested
                            });
                            let message = {
                                type: 're-correction request',
                                content: userId + ' is requesting re-correction for module ' + moduleId,
                                author: 'system'
                            };
                            Messages.createUserMessage(message,admins,(err, success) => {
                                if(err){
                                    console.log(err);
                                }
                            });                           
                            callback(null,'Successfully placed a recorrection request');
                        } else {
                            callback('you have already asked for re-correction',null);
                        }
                    } else {
                        callback('student is not a registered student of this module',null);
                    }
                } else {
                    callback('Results not released for this module',null);
                }
                
            } else {
                callback('no such module', null);
            }
        }).catch(err => {
            callback(err, null);
        });
    } else {
        callback('userId and/or moduleId must be non empty',null);
    }
};

/**
 * Use to create module messages for every student who has registered to the module
 * */
exports.createModuleMessage = function (moduleId,authorId,message,callback) {
    if(moduleId && authorId && message){
        db.collection('Modules').doc(moduleId).get().then(doc => {
            if(doc.exists){
                let data = doc.data();
                // make sure author is an admin
                if(data.admins.indexOf(authorId) > -1){
                    let _message = {
                        type:'module message',
                        content: message,
                        author:authorId
                    };
                    each(data.registeredStudents,(student,_callback) => {
                        Messages.createUserMessage(_message,student,(err,success) => {
                            if(err){
                                callback(err,null);
                            }
                            _callback();
                        });
                    }, (err) => {
                        if(err){
                            callback(err,null);
                        } else {
                            callback(null, 'successfully placed messages to all registered students');
                        }
                    });
                } else {
                    callback('you are not an admin of this module',null);
                }
            } else {
                callback('no such module',null);
            }
        }).catch(err => {
            callback(err, null);
        });
    } else {
        callback('moduleId, authorId and message must be non-empty',null)
    }
};