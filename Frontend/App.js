import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraView } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export default function App() {
    const [image, setImage] = useState(null);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [cameraPermission, setCameraPermission] = useState(null);
    const [cameraVisible, setCameraVisible] = useState(false);
    const cameraRef = React.useRef(null);

    // Request camera permission when component mounts
    React.useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setCameraPermission(status === 'granted');
        })();
    }, []);

    const pickImage = async () => {
        setIsLoading(true);
        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });

            if (!result.canceled) {
                await processImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Failed to pick image. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const takePicture = async () => {
        if (cameraRef.current) {
            setIsLoading(true);
            try {
                const photo = await cameraRef.current.takePictureAsync();
                const manipulatedImage = await manipulateAsync(
                    photo.uri,
                    [],
                    { compress: 0.7, format: SaveFormat.JPEG }
                );
                await processImage(manipulatedImage.uri);
                setCameraVisible(false);
            } catch (error) {
                console.error('Error taking picture:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const processImage = async (uri) => {
        try {
            // Create FormData object
            const formData = new FormData();
            formData.append('image', {
                uri,
                name: 'photo.jpg',
                type: 'image/jpeg',
            });

            // Replace with your actual backend URL
            const response = await fetch('http://192.168.1.102:3000/api/classify', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
            });


            if (!response.ok) {
                throw new Error('Failed to classify image');
            }

            const result = await response.json();
            setImage(uri);
            setResult(result);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to classify image. Please try again.');
        }
    };

    if (cameraVisible && cameraPermission) {
        return (
            <View style={styles.container}>
                <CameraView style={styles.camera} ref={cameraRef}>
                    <View style={styles.cameraButtonContainer}>
                        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>
                    </View>
                </CameraView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Waste Classifier</Text>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2e86ab" />
                    <Text style={styles.loadingText}>Classifying waste...</Text>
                </View>
            ) : (
                <>
                    {image && (
                        <Image source={{ uri: image }} style={styles.image} />
                    )}

                    {result && (
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultText}>
                                Category: {result.classification.category}
                            </Text>
                            <Text style={styles.resultText}>
                                Confidence: {(result.classification.confidence * 100).toFixed(0)}%
                            </Text>
                            <Text style={styles.resultDescription}>
                                {result.classification.description}
                            </Text>
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => setCameraVisible(true)}
                            disabled={!cameraPermission}
                        >
                            <Text style={styles.buttonText}>Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={pickImage}
                        >
                            <Text style={styles.buttonText}>Choose from Gallery</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        color: '#666',
    },
    image: {
        width: 300,
        height: 300,
        borderRadius: 10,
        marginBottom: 20,
    },
    resultContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        width: '100%',
    },
    resultText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    resultDescription: {
        fontSize: 16,
        color: '#666',
        marginTop: 10,
    },
    buttonContainer: {
        width: '100%',
    },
    button: {
        backgroundColor: '#2e86ab',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    cameraButtonContainer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    captureButton: {
        borderWidth: 3,
        borderColor: 'white',
        borderRadius: 50,
        padding: 3,
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
    },
});