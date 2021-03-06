import React, { useState } from 'react';
// To import font awesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
//Import icon
import { faFileUpload } from '@fortawesome/free-solid-svg-icons';
import { storage, database } from '../firebase/Firebase';
import { ROOT_FOLDER } from '../../hooks/folder/useFolder';
import { useAuth } from '../../contexts/AuthContext';
import { uuid } from 'uuidv4';
import { ProgressBar, Toast } from 'react-bootstrap';
//Used to display progress bar for file uploading
import ReactDOM from 'react-dom';
import './addFileButton.scss';
import firebase from 'firebase/app';

export default function AddFileButton({ currentFolder }) {
    const { currentUser } = useAuth();
    // Keep tracks of all the files being uploaded for progress bar
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const getFullFolderPath = () => {
        let arr = [];
        if (currentFolder) {
            arr = currentFolder.path
                .map((p) => p.name)
                .concat(currentFolder.name)
                .join('/');
        }
        return arr;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];

        if (currentFolder == null || file === null) {
            return;
        }
        const filePath =
            currentFolder === ROOT_FOLDER
                ? `/${file.name}`
                : getFullFolderPath() + `/${file.name}`;

        //setup for progress bar
        const id = uuid();
        setUploadingFiles((allPrevFiles) => [
            ...allPrevFiles,
            { id: id, name: file.name, progress: 0, error: false, completed: false },
        ]);
        // store it in storage
        //returns uploadTask which represents the process of uploading an object. Allows you to monitor and manage the upload.
        const uploadTask = storage
            .ref(`/files/${currentUser.uid}/${filePath}`)
            .put(file);

        //"state_change" have three callback functions (referred to as next: called repeatedly to keep track of progress of upload, error, and complete: runs after upload is completed )
        uploadTask.on(
            'state_change',
            (snapshot) => {
                const uploadProgress =
                    snapshot.bytesTransferred / snapshot.totalBytes;
                switch (snapshot.state) {
                    case firebase.storage.TaskState.RUNNING: // or 'running'
                        setUploadingFiles((prevUploadingFiles) => {
                            return prevUploadingFiles.map((uploadFile) => {
                                console.log(uploadFile);
                                if (uploadFile.id === id) {
                                    return {
                                        ...uploadFile,
                                        progress: uploadProgress,
                                    };
                                }

                                return uploadFile;
                            });
                        });
                    case firebase.storage.TaskState.SUCCESS: // or 'running'
                        setUploadingFiles((prevUploadingFiles) => {
                            return prevUploadingFiles.map((uploadFile) => {
                                if (uploadFile.id == id) {
                                    return {
                                        ...uploadFile,
                                        completed: true,
                                    };
                                }

                                return uploadFile;
                            });
                        });
                        break;
                }
            },
            (error) => {
                alert(error.message);
            },
            async () => {
                try {
                    const url = await uploadTask.snapshot.ref.getDownloadURL();
                    database.files.add({
                        url: url,
                        userId: currentUser.uid,
                        folderId: currentFolder.id,
                        name: file.name,
                        createdAt: database.getCurrentTimeStamp(),
                    });
                    setUploadingFiles((prevFiles) => {
                        return prevFiles.filter((uploadFile) => {
                            return uploadFile.id !== id;
                        });
                    });
                } catch (e) {
                    alert(e.message);
                }
            }
        ); // ------------
    };

    return (
        <>
            <label className='btn btn-outline-primary m-0'>
                <FontAwesomeIcon icon={faFileUpload} />
                {/* file inputs are hard to style so the convention is to insert it into a label tag and then hide it  */}
                <input
                    type='file'
                    onChange={handleFileUpload}
                    //used onChange instead of onClick because onClick runs after every click while onChange only runs only if a value change
                    //so it won't trigger on first click when no file is uploaded only when file is uploaded
                    // also it doesn't work with onclick only onchange and input
                    //https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
                    className='d-none'
                />
            </label>
            {ReactDOM.createPortal(
                <div className='d-flex flex-wrap progress-bar-container'>
                    {uploadingFiles.length > 0 &&
                        uploadingFiles.map((file) => {
                            return (
                                <Toast
                                    key={file.id}
                                    onClose={() => {
                                        setUploadingFiles((prevUploadingFiles) => {
                                            return prevUploadingFiles.filter(
                                                (uploadFile) => {
                                                    return uploadFile.id !== file.id;
                                                }
                                            );
                                        });
                                    }}
                                >
                                    <Toast.Header
                                        closeButton={file.error}
                                        className='text-truncate w-100 d-block'
                                    >
                                        {file.name}
                                    </Toast.Header>
                                    <Toast.Body>
                                        <ProgressBar
                                            animated={!file.error}
                                            variant={
                                                file.error ? 'danger' : 'primary'
                                            }
                                            now={
                                                file.error
                                                    ? 100
                                                    : file.progress * 100
                                            }
                                            label={
                                                file.error
                                                    ? 'Error'
                                                    : `${Math.round(
                                                          file.progress * 100
                                                      )}%`
                                            }
                                        />
                                    </Toast.Body>
                                </Toast>
                            );
                        })}
                </div>,
                document.body
            )}
        </>
    );
}
