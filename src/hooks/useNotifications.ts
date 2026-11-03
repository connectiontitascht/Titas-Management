import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { Notification } from '../types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
        setNotifications(notes);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );
    
    return () => unsubscribe();
  }, []);
  
  return notifications;
};
