import toast from 'react-hot-toast';

export function handleError(err, ctx = '') {
    console.error(ctx, err);
    const msg = err?.response?.data?.message || err?.message || 'Une erreur est survenue';
    toast.error(msg);
}
