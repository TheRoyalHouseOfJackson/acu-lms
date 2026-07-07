import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Programs from "@/pages/Programs";
import ProgramDetail from "@/pages/ProgramDetail";
import About from "@/pages/About";
import Apply from "@/pages/Apply";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import ProgramLearn from "@/pages/ProgramLearn";
import LessonPlayer from "@/pages/LessonPlayer";
import QuizPage from "@/pages/QuizPage";
import Certificate from "@/pages/Certificate";

import AdminHome from "@/pages/admin/AdminHome";
import AdminPrograms from "@/pages/admin/AdminPrograms";
import AdminProgramDetail from "@/pages/admin/AdminProgramDetail";
import AdminCourse from "@/pages/admin/AdminCourse";
import AdminLesson from "@/pages/admin/AdminLesson";
import AdminStudents from "@/pages/admin/AdminStudents";
import AdminQuiz from "@/pages/admin/AdminQuiz";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/programs" component={Programs} />
      <Route path="/programs/:slug/learn" component={ProgramLearn} />
      <Route path="/programs/:slug/courses/:courseId/lessons/:lessonId" component={LessonPlayer} />
      <Route path="/programs/:slug" component={ProgramDetail} />
      <Route path="/about" component={About} />
      <Route path="/apply" component={Apply} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/quizzes/:id" component={QuizPage} />
      <Route path="/certificates/:publicId" component={Certificate} />

      <Route path="/admin" component={AdminHome} />
      <Route path="/admin/programs" component={AdminPrograms} />
      <Route path="/admin/programs/:id" component={AdminProgramDetail} />
      <Route path="/admin/courses/:id" component={AdminCourse} />
      <Route path="/admin/lessons/:id" component={AdminLesson} />
      <Route path="/admin/students" component={AdminStudents} />
      <Route path="/admin/quizzes/:id" component={AdminQuiz} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
